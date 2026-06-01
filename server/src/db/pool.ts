import pg from "pg";
import { config } from "../config.js";
import { SCHEMA_SQL } from "./schema.js";

// Postgres returns NUMERIC as a string by default (good — preserves precision).
// Force it explicitly so no driver/version surprises lose financial precision.
pg.types.setTypeParser(1700, (val) => val); // NUMERIC/DECIMAL -> string

/**
 * Decide whether to use SSL. Managed/serverless Postgres (Neon, Supabase, etc.)
 * REQUIRE SSL — connecting without it throws and looks like a generic "server
 * error" in production (e.g. on Netlify). Local development does not use SSL.
 *
 *   - PGSSL=true|false  -> explicit override
 *   - sslmode=require in the URL, or a non-local host -> SSL on
 */
function resolveSsl(): pg.PoolConfig["ssl"] {
  const url = config.databaseUrl;
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)([:/?]|$)/.test(url);
  if (process.env.PGSSL === "false") return undefined;
  if (process.env.PGSSL === "true" || /sslmode=require/i.test(url) || !isLocal) {
    // Managed providers present chained certs; allow them without a local CA bundle.
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Serverless invocations should keep the pool tiny to avoid exhausting the DB.
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_MS ?? 10_000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_MS ?? 8_000),
  ssl: resolveSsl(),
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

/** Run a function inside a transaction, rolling back on any error. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Apply the (idempotent) schema, memoized per process. In a serverless runtime
 * there is no separate "migrate" step, so the function bootstraps the schema on
 * the first request of a cold start. On failure the promise is reset so the
 * next request can retry instead of being stuck with a rejected cache.
 */
const SCHEMA_LOCK_KEY = 729141; // arbitrary, stable advisory-lock id

let schemaPromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = applySchema().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function applySchema(): Promise<void> {
  const client = await pool.connect();
  try {
    // Serialize across all concurrent cold-start instances. Without this, two
    // containers running CREATE INDEX / ALTER TABLE on the same catalog rows at
    // once can deadlock and surface as sporadic 500s. The DDL itself is idempotent.
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_KEY]);
    try {
      await client.query(SCHEMA_SQL);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
