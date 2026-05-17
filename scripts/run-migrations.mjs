#!/usr/bin/env node
/**
 * Runs SQL migrations in db/migrations/ in lexical order.
 * Invoked automatically by docker-entrypoint.sh on container start.
 * Requires: DATABASE_URL
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = process.env.APP_ROOT?.trim() || join(scriptDir, "..");
const migrationsDir = join(appRoot, "db", "migrations");

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

if (!existsSync(migrationsDir)) {
  console.error(`[migrate] migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const pg = await import("pg");
const client = new pg.default.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  console.log("[migrate] connected");

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

  if (files.length === 0) {
    console.log("[migrate] no migration files found");
  }

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT 1 FROM app.schema_migrations WHERE filename = $1",
      [file],
    );
    if (rows.length > 0) {
      console.log(`[migrate] skip ${file}`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`[migrate] apply ${file}`);
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

  console.log("[migrate] complete");
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
