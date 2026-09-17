/**
 * One-time migration: read existing reservations from the local SQLite database
 * and upload each one to Vercel Private Blob as `reservations/<table>/<seat>.json`.
 *
 * Usage (from the Mahbib project root):
 *   npx tsx scripts/migrate-to-blob.ts
 *
 * Prerequisites:
 *   - node:sqlite and the local `data/wedding.db` must be readable (run locally,
 *     not on Vercel).
 *   - BLOB_READ_WRITE_TOKEN must be set in the environment (Vercel auto-injects it
 *     for server-side code; locally, copy it from your Vercel project settings).
 *
 * This script is intentionally NOT run automatically during production startup.
 * Run it once when you first deploy the Vercel-Blob-backed version, then disable
 * or delete it.
 *
 * Safety:
 *   - Uses `allowOverwrite: false` for seat blobs, so it will refuse to clobber
 *     an existing reservation. If a seat is already present in Blob storage, the
 *     script logs a warning and skips that seat.
 *   - Also migrates the monotonic id counter and the id->path mapping so that
 *     existing reservation ids are preserved.
 */

import { put } from "@vercel/blob";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.resolve(process.cwd(), "data", "wedding.db");

interface Row {
  id: number | bigint;
  invite_code: string;
  name: string;
  email: string;
  category: string;
  table_name: string;
  seat: number | bigint;
  created_at: string;
}

interface IdMapEntry {
  id: number;
  table: string;
  seat: number;
}

async function main(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "ERROR: BLOB_READ_WRITE_TOKEN is not set. Copy it from your Vercel project settings.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`ERROR: SQLite database not found at ${DB_PATH}.`);
    console.error("Run this script locally where data/wedding.db exists.");
    process.exit(1);
  }

  console.log(`Reading reservations from ${DB_PATH}`);
  const database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA journal_mode = WAL;");

  const rows = database
    .prepare("SELECT id, invite_code, name, email, category, table_name, seat, created_at FROM reservations ORDER BY id")
    .all() as unknown as Row[];

  console.log(`Found ${rows.length} reservations in SQLite.`);

  if (rows.length === 0) {
    console.log("No reservations to migrate. Done.");
    return;
  }

  const idMap: IdMapEntry[] = [];
  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const reservation = {
      id: Number(row.id),
      inviteCode: row.invite_code,
      name: row.name,
      email: row.email,
      category: row.category,
      table: row.table_name,
      seat: Number(row.seat),
      createdAt: row.created_at,
    };

    const seatPath = `reservations/${encodeURIComponent(row.table_name.trim())}/${Number(row.seat)}.json`;

    try {
      await put(seatPath, JSON.stringify(reservation, null, 2), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: false,
      });
      idMap.push({ id: reservation.id, table: row.table_name, seat: Number(row.seat) });
      migrated++;
      console.log(`  migrated id=${reservation.id} -> ${seatPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists|condition|precondition/i.test(message)) {
        skipped++;
        console.warn(`  SKIP id=${reservation.id} ${seatPath} (already exists in Blob)`);
      } else {
        console.error(`  ERROR id=${reservation.id} ${seatPath}: ${message}`);
      }
    }
  }

  // Migrate the counter + id map together.
  const maxId = rows.length > 0 ? Math.max(...rows.map((r) => Number(r.id))) : 0;
  try {
    await put("reservations/_meta/counter.json", JSON.stringify({ nextId: maxId + 1 }, null, 2), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
    console.log(`  migrated counter: nextId=${maxId + 1}`);
  } catch (error) {
    console.error(`  ERROR writing counter: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await put("reservations/_meta/id-map.json", JSON.stringify({ ids: idMap }, null, 2), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
    console.log(`  migrated id map: ${idMap.length} entries`);
  } catch (error) {
    console.error(`  ERROR writing id map: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("");
  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped.`);
  console.log("You can now deploy the Vercel-Blob-backed version.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
