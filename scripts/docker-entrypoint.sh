#!/bin/sh
set -e

# Automatic DB setup on every deploy (white-label / re-install friendly)
if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] waiting for PostgreSQL..."
  node /app/scripts/wait-for-database.mjs

  echo "[entrypoint] applying SQL migrations..."
  node /app/scripts/run-migrations.mjs
else
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=false, skipping migrations"
fi

echo "[entrypoint] starting application: $*"
exec "$@"
