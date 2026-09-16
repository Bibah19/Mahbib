/**
 * Data access for seat reservations.
 *
 * Everything the rest of the app needs lives here: availability for the seat
 * picker, the atomic "reserve this seat" mutation, personal invite codes, an
 * admin list and CSV export.
 */

import { randomBytes } from "node:crypto";
import { getDb, isUniqueConstraintError } from "./db";
import {
  getCategories,
  getCategoryQuota,
  getTablesForCategory,
  getTotalSeats,
} from "./seating";
import type {
  Availability,
  AvailabilityCategory,
  AvailabilityTable,
  Reservation,
  ReserveSeatInput,
  ReserveSeatResult,
} from "./types";

type ReservationRow = {
  id: number | bigint;
  invite_code: string;
  name: string;
  email: string;
  category: string;
  table_name: string;
  seat: number | bigint;
  created_at: string;
};

const RESERVATION_COLUMNS =
  "id, invite_code, name, email, category, table_name, seat, created_at";

function mapReservation(row: ReservationRow): Reservation {
  return {
    id: Number(row.id),
    inviteCode: row.invite_code,
    name: row.name,
    email: row.email,
    category: row.category,
    table: row.table_name,
    seat: Number(row.seat),
    createdAt: row.created_at,
  };
}

/** `/invite/ABCD1234`, the personal link each guest receives. */
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

/** Occupied seat numbers on one physical table for the live seat map. */
function readOccupiedSeats(): Map<string, Set<number>> {
  const rows = getDb()
    .prepare("SELECT table_name, seat FROM reservations")
    .all() as unknown as { table_name: string; seat: number | bigint }[];

  const occupied = new Map<string, Set<number>>();

  for (const row of rows) {
    const seats = occupied.get(row.table_name) ?? new Set<number>();
    seats.add(Number(row.seat));
    occupied.set(row.table_name, seats);
  }

  return occupied;
}

/** Full, real-time seat map used by the picker and by the API. */
export function getAvailability(): Availability {
  // Physical truth: one chair, one table, one seat number. Ranges handed to
  // different categories never overlap, so filtering global occupancy to the
  // range also equals that category's own bookings.
  const occupiedByTable = readOccupiedSeats();
  let totalSeats = 0;
  let occupiedSeats = 0;

  const categories: AvailabilityCategory[] = getCategories().map((category) => {
    let categorySeats = 0;
    let categoryOccupied = 0;

    const tables: AvailabilityTable[] = getTablesForCategory(category).map((table) => {
      const taken = Array.from(occupiedByTable.get(table.name) ?? [])
        .filter((seat) => seat >= table.from && seat <= table.to)
        .sort((a, b) => a - b);

      categorySeats += table.seatCount;
      categoryOccupied += taken.length;

      return {
        name: table.name,
        from: table.from,
        to: table.to,
        seatCount: table.seatCount,
        occupied: taken,
        availableCount: table.seatCount - taken.length,
      };
    });

    totalSeats += categorySeats;
    occupiedSeats += categoryOccupied;

    return {
      name: category,
      tables,
      seatCount: categorySeats,
      occupiedCount: categoryOccupied,
      quota: getCategoryQuota(category),
    };
  });

  return {
    categories,
    totalSeats: totalSeats || getTotalSeats(),
    occupiedSeats,
    updatedAt: new Date().toISOString(),
  };
}

export function getReservationById(id: number): Reservation | null {
  const row = getDb()
    .prepare(`SELECT ${RESERVATION_COLUMNS} FROM reservations WHERE id = ?`)
    .get(id) as unknown as ReservationRow | undefined;

  return row ? mapReservation(row) : null;
}

export function getReservationByInviteCode(inviteCode: string): Reservation | null {
  const row = getDb()
    .prepare(`SELECT ${RESERVATION_COLUMNS} FROM reservations WHERE invite_code = ?`)
    .get(inviteCode.toUpperCase()) as unknown as ReservationRow | undefined;

  return row ? mapReservation(row) : null;
}

/**
 * Looks up the guest holding a specific chair.
 *
 * A chair belongs to a table and a seat number, so that pair is the identity
 * used everywhere: the two family categories share the High Table, and seat 3
 * there can only ever belong to one guest.
 */
export function getReservationByTableSeat(table: string, seat: number): Reservation | null {
  const row = getDb()
    .prepare(
      `SELECT ${RESERVATION_COLUMNS} FROM reservations WHERE table_name = ? AND seat = ?`,
    )
    .get(table, seat) as unknown as ReservationRow | undefined;

  return row ? mapReservation(row) : null;
}

/** Previous name kept for callers; a chair is identified by table and seat. */
export function getReservationBySeat(
  _category: string,
  table: string,
  seat: number,
): Reservation | null {
  return getReservationByTableSeat(table, seat);
}

/** Newest first, used by the admin view and the CSV export. */
export function listReservations(): Reservation[] {
  const rows = getDb()
    .prepare(`SELECT ${RESERVATION_COLUMNS} FROM reservations ORDER BY id DESC`)
    .all() as unknown as ReservationRow[];

  return rows.map(mapReservation);
}

/** Is this chair still free? */
export function isSeatAvailable(table: string, seat: number): boolean {
  return getReservationByTableSeat(table, seat) === null;
}

/**
 * Saves the reservation with a single atomic INSERT.
 *
 * The database itself refuses a duplicate seat, so two guests can never hold
 * the same chair: the loser gets `conflict: true` plus fresh availability.
 */
export function reserveSeat(input: ReserveSeatInput): ReserveSeatResult {
  const database = getDb();
  const createdAt = new Date().toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = createInviteCode();

    try {
      const result = database
        .prepare(
          `INSERT INTO reservations
             (invite_code, name, email, category, table_name, seat, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          inviteCode,
          input.name,
          input.email,
          input.category,
          input.table,
          input.seat,
          createdAt,
        );

      const reservation = getReservationById(Number(result.lastInsertRowid));

      if (!reservation) {
        return { ok: false, error: "The seat could not be saved. Please try again." };
      }

      return {
        ok: true,
        reservation,
        invitePath: buildInvitePath(reservation.inviteCode),
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      // The invite code collided (very unlikely), so just try another one.
      if (isSeatAvailable(input.table, input.seat)) continue;

      return {
        ok: false,
        conflict: true,
        error: `Seat ${input.seat} on the ${input.table} was just taken by another guest. Please choose another seat.`,
        availability: getAvailability(),
      };
    }
  }

  return {
    ok: false,
    error: "We could not save this seat. Please refresh the page and try again.",
  };
}

/** Frees a seat (admin action). Returns true when a row was removed. */
export function releaseSeat(id: number): boolean {
  const result = getDb().prepare("DELETE FROM reservations WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}

/** Guest-facing summary counts. */
export function getSeatSummary(): {
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
} {
  const availability = getAvailability();
  return {
    totalSeats: availability.totalSeats,
    occupiedSeats: availability.occupiedSeats,
    availableSeats: Math.max(availability.totalSeats - availability.occupiedSeats, 0),
  };
}

/** Table + seat counts are defined in `lib/seating.ts` (getPlanSummary). */

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
