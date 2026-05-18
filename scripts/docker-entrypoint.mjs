#!/usr/bin/env node
/**
 * Container entrypoint — avoids shell/CRLF issues on Windows builds.
 * 1. Wait for Postgres  2. Run migrations  3. Exec CMD (API)
 */
import { spawnSync } from "node:child_process";

function runNodeScript(label, scriptPath) {
  console.log(`[entrypoint] ${label}`);
  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const runMigrations = process.env.RUN_MIGRATIONS_ON_START !== "false";

if (runMigrations) {
  runNodeScript("waiting for PostgreSQL", "/app/scripts/wait-for-database.mjs");
  runNodeScript("applying SQL migrations", "/app/scripts/run-migrations.mjs");
} else {
  console.log("[entrypoint] RUN_MIGRATIONS_ON_START=false, skipping migrations");
}

if (process.env.RESET_DEV_DATA_ON_START === "true") {
  runNodeScript("resetting dev data (Postgres + Redis)", "/app/scripts/reset-dev-data.mjs");
}

const cmd = process.argv.slice(2);
if (cmd.length === 0) {
  console.error("[entrypoint] no command to run");
  process.exit(1);
}

console.log(`[entrypoint] starting: ${cmd.join(" ")}`);
const child = spawnSync(cmd[0], cmd.slice(1), {
  stdio: "inherit",
  env: process.env,
});
process.exit(child.status ?? 1);
