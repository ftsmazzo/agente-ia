#!/usr/bin/env node
/**
 * Waits until PostgreSQL accepts connections (container startup / EasyPanel).
 * Env: DATABASE_URL, DB_WAIT_MAX_ATTEMPTS (default 30), DB_WAIT_DELAY_MS (default 2000)
 */
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[wait-db] DATABASE_URL is required");
  process.exit(1);
}

const maxAttempts = Number(process.env.DB_WAIT_MAX_ATTEMPTS ?? 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS ?? 2000);

const pg = await import("pg");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const client = new pg.default.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    console.log(`[wait-db] PostgreSQL ready (attempt ${attempt}/${maxAttempts})`);
    process.exit(0);
  } catch (err) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      `[wait-db] attempt ${attempt}/${maxAttempts} failed: ${message}`,
    );
    if (attempt === maxAttempts) {
      console.error("[wait-db] PostgreSQL not available, giving up");
      process.exit(1);
    }
    await sleep(delayMs);
  }
}
