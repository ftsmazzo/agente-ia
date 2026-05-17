#!/usr/bin/env node
/**
 * Runs SQL migrations in db/migrations/ in lexical order.
 * Requires: DATABASE_URL
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".")), "..");
const migrationsDir = join(ROOT, "db", "migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("Install pg package at root for migrations: npm install pg");
  process.exit(1);
}

const client = new pg.default.Client({ connectionString: databaseUrl });
await client.connect();

await client.query("CREATE SCHEMA IF NOT EXISTS app");

await client.query(`
  CREATE TABLE IF NOT EXISTS app.schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const { rows } = await client.query(
    "SELECT 1 FROM app.schema_migrations WHERE filename = $1",
    [file],
  );
  if (rows.length > 0) {
    console.log(`skip ${file}`);
    continue;
  }

  const sql = readFileSync(join(migrationsDir, file), "utf-8");
  console.log(`apply ${file}`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO app.schema_migrations (filename) VALUES ($1)",
      [file],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

await client.end();
console.log("Migrations complete.");
