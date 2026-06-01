import pg from "pg";
import { config } from "../config.js";

// Postgres returns NUMERIC as a string by default (good — preserves precision).
// Force it explicitly so no driver/version surprises lose financial precision.
pg.types.setTypeParser(1700, (val) => val); // NUMERIC/DECIMAL -> string

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
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
