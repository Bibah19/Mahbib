/**
 * SQLite data store for seat reservations.
 *
 * Uses Node's built-in `node:sqlite` (no native build step, no extra package)
 * and stores the database in `./data/wedding.db`. That file is gitignored.
 *
 * This is a real database: the `UNIQUE (category, table_name, seat)` constraint
 * is what makes it impossible for two guests on two different phones to take
 * the same seat, even if they submit at the same moment.
 *
 * Hosted deployment note: if you deploy to a platform with an ephemeral
 * filesystem (for example Vercel), point `WEDDING_DB_PATH` at a persistent
 * volume, or swap this one file for a hosted Postgres/Supabase client. Every
 * other file only talks to the functions exported from `lib/reservations.ts`.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { validateSeatingPlan } from "./seating";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "wedding.db");

export const DB_PATH = process.env.WEDDING_DB_PATH || DEFAULT_DB_PATH;

/** Keeps one connection alive across dev hot reloads. */
const globalForDb = globalThis as unknown as { __weddingDb?: DatabaseSync };

const RESERVATIONS_COLUMNS_SQL = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  table_name TEXT NOT NULL,
  seat INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (table_name, seat)
`;

/**
 * A physical chair is identified by its table and its seat number, so the seat
 * itself carries the uniqueness rule. That is what stops the shared High Table
 * (seats 1 to 5 for the groom's family, 6 to 10 for the bride's family) from
 * ever handing the same chair to two guests.
 *
 * The rule used to include the category, so existing databases are upgraded in
 * place. The copy-then-swap keeps every reservation intact.
 */
function migrateSeatConstraint(database: DatabaseSync): void {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reservations'")
    .get() as { sql?: string } | undefined;

  const existingSql = row?.sql ?? "";

  if (!existingSql || existingSql.includes("UNIQUE (table_name, seat)")) return;

  console.info("[wedding] Upgrading seat uniqueness to table + seat.");

  try {
    database.exec("BEGIN IMMEDIATE");
    database.exec(`CREATE TABLE reservations_upgraded (${RESERVATIONS_COLUMNS_SQL});`);
    database.exec(`
      INSERT INTO reservations_upgraded
        (id, invite_code, name, email, category, table_name, seat, created_at)
      SELECT id, invite_code, name, email, category, table_name, seat, created_at
      FROM reservations;
    `);
    database.exec("DROP TABLE reservations;");
    database.exec("ALTER TABLE reservations_upgraded RENAME TO reservations;");
    database.exec("COMMIT");
    console.info("[wedding] Reservations table upgraded.");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Nothing to roll back.
    }
    console.error(
      "[wedding] Could not upgrade the reservations table. The site still works, but a seat could be booked twice. Reason:",
      error,
    );
  }
}

function createSchema(database: DatabaseSync): void {
  database.exec(`CREATE TABLE IF NOT EXISTS reservations (${RESERVATIONS_COLUMNS_SQL});`);
  migrateSeatConstraint(database);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_reservations_category_table
      ON reservations (category, table_name);
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_reservations_table_seat
      ON reservations (table_name, seat);
  `);
}

/** Shouts in development when the seating plan stops adding up. */
function warnAboutSeatingPlan(): void {
  if (process.env.NODE_ENV === "production") return;

  for (const issue of validateSeatingPlan()) {
    console.warn(`[wedding] Seating plan problem: ${issue}`);
  }
}

/** Opens (once) and returns the database connection. */
export function getDb(): DatabaseSync {
  if (globalForDb.__weddingDb) return globalForDb.__weddingDb;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const database = new DatabaseSync(DB_PATH);
  try {
    database.exec("PRAGMA journal_mode = WAL;");
  } catch {
    // WAL is a performance nicety only; ignore platforms that refuse it.
  }
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA foreign_keys = ON;");

  createSchema(database);
  warnAboutSeatingPlan();
  globalForDb.__weddingDb = database;

  return database;
}

/** True when the error is a SQLite UNIQUE constraint violation. */
export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return (
    code === "ERR_SQLITE_ERROR" &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(error.message)
  );
}