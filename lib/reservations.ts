/** Server-only Postgres persistence; one row per physical seat. */
import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import type { BookingDiagnostics } from "./booking-diagnostics";

import { query } from "./db";
import { getCategories, getCategoryQuota, getTablesForCategory } from "./seating";
import type {
  Availability,
  AvailabilityCategory,
  AvailabilityTable,
  Reservation,
  ReserveSeatInput,
  ReserveSeatResult,
} from "./types";

type ReservationRow = {
  id: string | number;
  invite_code: string;
  name: string;
  email: string;
  category: string;
  table_name: string;
  seat: number;
  created_at: Date | string;
};

const COLUMNS =
  "id, invite_code, name, email, category, table_name, seat, created_at";

function mapRow(row: ReservationRow): Reservation {
  return {
    id: Number(row.id),
    inviteCode: row.invite_code,
    name: row.name,
    email: row.email,
    category: row.category,
    table: row.table_name,
    seat: row.seat,
    createdAt: new Date(row.created_at).toISOString(),
  };
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

async function readOccupiedSeats(): Promise<Map<string, Set<number>>> {
  const occupied = new Map<string, Set<number>>();
  const { rows } = await query<{ table_name: string; seat: number }>(
    "SELECT table_name, seat FROM reservations",
  );
  for (const row of rows) {
    const seats = occupied.get(row.table_name) ?? new Set<number>();
    seats.add(row.seat);
    occupied.set(row.table_name, seats);
  }
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
  const { rows } = await query<ReservationRow>(
    `SELECT ${COLUMNS} FROM reservations WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getReservationByInviteCode(
  inviteCode: string,
): Promise<Reservation | null> {
  const { rows } = await query<ReservationRow>(
    `SELECT ${COLUMNS} FROM reservations WHERE invite_code = $1`,
    [inviteCode.toUpperCase()],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getReservationByTableSeat(
  table: string,
  seat: number,
): Promise<Reservation | null> {
  const { rows } = await query<ReservationRow>(
    `SELECT ${COLUMNS} FROM reservations WHERE table_name = $1 AND seat = $2`,
    [table.trim(), seat],
  );
  return rows[0] ? mapRow(rows[0]) : null;
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
  return (await getReservationByTableSeat(table, seat)) === null;
}

export async function listReservations(): Promise<Reservation[]> {
  const { rows } = await query<ReservationRow>(
    `SELECT ${COLUMNS} FROM reservations ORDER BY created_at DESC, id DESC`,
  );
  return rows.map(mapRow);
}

/**
 * Saves the reservation with a single atomic INSERT.
 *
 * A unique constraint on (table_name, seat) means two guests can never hold
 * the same chair: the loser gets `conflict: true` plus fresh availability.
 * A colliding invite code or id triggers another attempt with new values.
 */
export async function reserveSeat(
  input: ReserveSeatInput,
  diagnostics?: BookingDiagnostics,
): Promise<ReserveSeatResult> {
  diagnostics?.protect(input.name, input.email);
  const table = input.table.trim();

  const conflict = async (): Promise<ReserveSeatResult> => {
    diagnostics?.step("conflict_availability");
    return {
      ok: false,
      conflict: true,
      error: `Seat ${input.seat} on the ${input.table} was just taken by another guest. Please choose another seat.`,
      availability: await getAvailability(),
    };
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = createInviteCode();
    diagnostics?.protect(inviteCode);

    diagnostics?.step("seat_availability_check");
    if (!(await isSeatAvailable(table, input.seat))) {
      diagnostics?.log("warn", "seat_occupied");
      return conflict();
    }

    const id = randomInt(1, 2 ** 48 - 1);

    try {
      diagnostics?.writeAttempted();
      const { rows } = await query<ReservationRow>(
        `INSERT INTO reservations (id, invite_code, name, email, category, table_name, seat)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [id, inviteCode, input.name, input.email, input.category, table, input.seat],
      );
      diagnostics?.writeConfirmed();
      const stored = mapRow(rows[0]);
      return {
        ok: true,
        reservation: stored,
        invitePath: buildInvitePath(stored.inviteCode),
      };
    } catch (error) {
      const err = error as { code?: string; constraint?: string };
      if (err.code === "23505") {
        if (err.constraint?.includes("seat")) {
          diagnostics?.log("warn", "conflict_detected", error, 409);
          return conflict();
        }
        // invite_code or id collided: retry with fresh random values.
        continue;
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

/** Frees a seat (admin action). Returns true when a row was removed. */
export async function releaseSeat(id: number): Promise<boolean> {
  try {
    const result = await query("DELETE FROM reservations WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
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
