/** Server-only private Blob persistence; one JSON object per physical seat. */
import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import type { BookingDiagnostics } from "./booking-diagnostics";

import { list, get, put, del, BlobPreconditionFailedError, BlobNotFoundError } from "./storage";
import { getCategories, getCategoryQuota, getTablesForCategory } from "./seating";
import type {
  Availability,
  AvailabilityCategory,
  AvailabilityTable,
  Reservation,
  ReserveSeatInput,
  ReserveSeatResult,
} from "./types";

function seatBlobPath(table: string, seat: number): string {
  return `reservations/${encodeURIComponent(table.trim())}/${seat}.json`;
}

const SEAT_PREFIX = "reservations/";
// Ignore metadata left by an earlier implementation; never read or write it.
const COUNTER_BLOB = "reservations/_meta/counter.json";
const ID_MAP_BLOB = "reservations/_meta/id-map.json";

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

async function reservationBlobExists(table: string, seat: number): Promise<boolean> {
  return (await readReservationBlob(seatBlobPath(table, seat))) !== null;
}

async function readReservationBlob(pathname: string): Promise<Reservation | null> {
  try {
    const result = await get(pathname, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return null;
    const text = await streamToText(result.stream);
    return JSON.parse(text) as Reservation;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export function buildInvitePath(inviteCode: string): string {
  return `/invite/${inviteCode}`;
}

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createInviteCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

function mapReservation(raw: Reservation): Reservation {
  return {
    id: raw.id,
    inviteCode: raw.inviteCode,
    name: raw.name,
    email: raw.email,
    category: raw.category,
    table: raw.table,
    seat: raw.seat,
    createdAt: raw.createdAt,
  };
}

async function readOccupiedSeats(): Promise<Map<string, Set<number>>> {
  const occupied = new Map<string, Set<number>>();
  let cursor: string | undefined;
  let page = await list({ prefix: SEAT_PREFIX, limit: 100, cursor });
  do {
    for (const blob of page.blobs) {
      if (blob.pathname === COUNTER_BLOB || blob.pathname === ID_MAP_BLOB)
        continue;
      const reservation = await readReservationBlob(blob.pathname);
      if (!reservation) continue;
      const seats = occupied.get(reservation.table) ?? new Set<number>();
      seats.add(reservation.seat);
      occupied.set(reservation.table, seats);
    }
    cursor = page.cursor;
    if (cursor)
      page = await list({ prefix: SEAT_PREFIX, limit: 100, cursor });
  } while (cursor);
  return occupied;
}

export async function getAvailability(): Promise<Availability> {
  const occupiedByTable = await readOccupiedSeats();
  let totalSeats = 0;
  let occupiedSeats = 0;

  const categories: AvailabilityCategory[] = getCategories().map((category) => {
    let categorySeats = 0;
    let categoryOccupied = 0;

    const tables: AvailabilityTable[] = getTablesForCategory(category).map(
      (table) => {
        const taken = Array.from(occupiedByTable.get(table.name) ?? [])
          .filter((seat) => seat >= table.from && seat <= table.to)
          .sort((a, b) => a - b);
        return {
          name: table.name,
          from: table.from,
          to: table.to,
          seatCount: table.seatCount,
          occupied: taken,
          availableCount: table.seatCount - taken.length,
        };
      },
    );

    for (const t of tables) {
      categorySeats += t.seatCount;
      categoryOccupied += t.occupied.length;
    }

    return {
      name: category,
      tables,
      seatCount: categorySeats,
      occupiedCount: categoryOccupied,
      quota: getCategoryQuota(category),
    };
  });

  for (const category of categories) {
    totalSeats += category.seatCount;
    occupiedSeats += category.occupiedCount;
  }

  return {
    totalSeats,
    occupiedSeats,
    categories,
    updatedAt: new Date().toISOString(),
  };
}

export async function getSeatSummary(): Promise<{
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
}> {
  const availability = await getAvailability();
  return {
    totalSeats: availability.totalSeats,
    occupiedSeats: availability.occupiedSeats,
    availableSeats:
      Math.max(availability.totalSeats - availability.occupiedSeats, 0),
  };
}


export async function getReservationById(
  id: number,
): Promise<Reservation | null> {
  const reservations = await listReservations();
  return reservations.find((reservation) => reservation.id === id) ?? null;
}

export async function getReservationByInviteCode(
  inviteCode: string,
): Promise<Reservation | null> {
  const upper = inviteCode.toUpperCase();
  let cursor: string | undefined;
  let page = await list({ prefix: SEAT_PREFIX, limit: 100, cursor });
  do {
    for (const blob of page.blobs) {
      if (blob.pathname === COUNTER_BLOB || blob.pathname === ID_MAP_BLOB)
        continue;
      const reservation = await readReservationBlob(blob.pathname);
      if (reservation && reservation.inviteCode.toUpperCase() === upper) {
        return mapReservation(reservation);
      }
    }
    cursor = page.cursor;
    if (cursor)
      page = await list({ prefix: SEAT_PREFIX, limit: 100, cursor });
  } while (cursor);
  return null;
}

export async function getReservationByTableSeat(
  table: string,
  seat: number,
): Promise<Reservation | null> {
  return readReservationBlob(seatBlobPath(table, seat));
}

/** Previous name kept for callers; a chair is identified by table and seat. */
export function getReservationBySeat(
  _category: string,
  table: string,
  seat: number,
): Promise<Reservation | null> {
  return getReservationByTableSeat(table, seat);
}

export async function isSeatAvailable(table: string, seat: number): Promise<boolean> {
  return !(await reservationBlobExists(table, seat));
}

export async function listReservations(): Promise<Reservation[]> {
  const reservations: Reservation[] = [];
  let cursor: string | undefined;
  let page = await list({ prefix: SEAT_PREFIX, limit: 100, cursor });
  do {
    for (const blob of page.blobs) {
      if (blob.pathname === COUNTER_BLOB || blob.pathname === ID_MAP_BLOB)
        continue;
      const reservation = await readReservationBlob(blob.pathname);
      if (reservation) reservations.push(reservation);
    }
    cursor = page.cursor;
    if (cursor)
      page = await list({ prefix: SEAT_PREFIX, limit: 100, cursor });
  } while (cursor);
  reservations.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return reservations;
}


/**
 * Saves the reservation with a single atomic create.
 *
 * The seat blob is created with `allowOverwrite: false`, so two guests can
 * never hold the same chair: the loser gets `conflict: true` plus fresh
 * availability. Invite codes are still unique per guest, so a colliding code
 * triggers another attempt.
 */
export async function reserveSeat(
  input: ReserveSeatInput,
  diagnostics?: BookingDiagnostics,
): Promise<ReserveSeatResult> {
  diagnostics?.protect(input.name, input.email);
  const createdAt = new Date().toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = createInviteCode();
    diagnostics?.protect(inviteCode);
    diagnostics?.step("invite_code_lookup");

    if (await getReservationByInviteCode(inviteCode) !== null) {
      continue;
    }

    diagnostics?.step("seat_availability_check");
    if (!(await isSeatAvailable(input.table, input.seat))) {
      diagnostics?.log("warn", "seat_occupied");
      diagnostics?.step("conflict_availability");
      return {
        ok: false,
        conflict: true,
        error: `Seat ${input.seat} on the ${input.table} was just taken by another guest. Please choose another seat.`,
        availability: await getAvailability(),
      };
    }

    // Keep numeric IDs without a shared, non-atomic max-ID counter.
    const nextId = randomInt(1, 2 ** 48 - 1);
    diagnostics?.step("reservation_id_lookup");
    if (await getReservationById(nextId) !== null) continue;
    const reservation: Reservation = {
      id: nextId,
      inviteCode,
      name: input.name,
      email: input.email,
      category: input.category,
      table: input.table,
      seat: input.seat,
      createdAt,
    };

    try {
      diagnostics?.writeAttempted();
      await put(
        seatBlobPath(input.table, input.seat),
        JSON.stringify(reservation, null, 2),
        {
          access: "private",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: false,
        },
      );

      diagnostics?.writeConfirmed();
      diagnostics?.step("reservation_read_back");
      const stored = await readReservationBlob(
        seatBlobPath(input.table, input.seat),
      );
      if (!stored) {
        diagnostics?.log("error", "read_back_missing", new Error("Write succeeded but reservation read-back returned no record."), 500);
        return {
          ok: false,
          error: "The seat could not be saved. Please try again.",
        };
      }

      return {
        ok: true,
        reservation: mapReservation(stored),
        invitePath: buildInvitePath(stored.inviteCode),
      };
    } catch (error) {
      if (isSeatConflictError(error)) {
        diagnostics?.log("warn", "conflict_detected", error, 409);
        if (attempt < 4) continue;
        diagnostics?.step("conflict_availability");
        return {
          ok: false,
          conflict: true,
          error: `Seat ${input.seat} on the ${input.table} was just taken by another guest. Please choose another seat.`,
          availability: await getAvailability(),
        };
      }
      throw error;
    }
  }

  diagnostics?.log("error", "attempts_exhausted", undefined, 500);
  return {
    ok: false,
    error:
      "We could not save this seat. Please refresh the page and try again.",
  };
}

function isSeatConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof BlobPreconditionFailedError) return true;
  const message = error.message ?? "";
  return /already exists|condition|precondition/i.test(message);
}

/** Frees a seat (admin action). Returns true when a row was removed. */
export async function releaseSeat(id: number): Promise<boolean> {
  const reservation = await getReservationById(id);
  if (!reservation) return false;

  const pathname = seatBlobPath(reservation.table, reservation.seat);

  try {
    await del(pathname);
  } catch {
    return false;
  }

  return true;
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

/** CSV export for the couple (opens straight in Excel or Google Sheets). */
export function reservationsToCsv(reservations: Reservation[]): string {
  const header = [
    "ID",
    "Invite Code",
    "Invitee Name",
    "Email",
    "Category",
    "Table",
    "Seat",
    "Reserved At",
  ];

  const lines = [header.join(",")];

  for (const reservation of reservations) {
    lines.push(
      [
        reservation.id,
        reservation.inviteCode,
        reservation.name,
        reservation.email,
        reservation.category,
        reservation.table,
        reservation.seat,
        reservation.createdAt,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
  }

  return lines.join("\n");
}
