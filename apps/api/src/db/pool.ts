import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(databaseUrl: string): pg.Pool {
  if (!pool) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function checkDatabase(databaseUrl: string): Promise<boolean> {
  const client = await getPool(databaseUrl).connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
