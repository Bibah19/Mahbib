/** Server-only Postgres access (DATABASE_URL). */
import "server-only";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __pgReady?: Promise<void>;
};

function getPool(): Pool {
  if (!globalForDb.__pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    const isLocal = /@(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
    globalForDb.__pgPool = new Pool({
      connectionString: url,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalForDb.__pgPool;
}

async function ensureSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id BIGINT PRIMARY KEY,
      invite_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      table_name TEXT NOT NULL,
      seat INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (table_name, seat)
    )
  `);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  if (!globalForDb.__pgReady) {
    globalForDb.__pgReady = ensureSchema().catch((error) => {
      globalForDb.__pgReady = undefined;
      throw error;
    });
  }
  await globalForDb.__pgReady;
  return getPool().query<T>(text, params);
}
