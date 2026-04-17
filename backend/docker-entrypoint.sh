#!/bin/sh
set -e

echo "[Entrypoint] Initializing backend service..."

# Unless explicitly disabled, run database migrations on container startup
if [ "$RUN_MIGRATIONS" != "false" ]; then
  echo "[Entrypoint] Running database migrations..."
  if [ -f "dist/knexfile.js" ] && [ ! -f "knexfile.ts" ]; then
    npx knex migrate:latest --knexfile dist/knexfile.js || { echo "[Entrypoint] Migrations failed!"; exit 1; }
  else
    npm run db:migrate || { echo "[Entrypoint] Migrations failed!"; exit 1; }
  fi
fi

# Run seeders unless explicitly skipped
if [ "$SKIP_SEEDS" != "true" ]; then
  echo "[Entrypoint] Running database seeds..."
  if [ -f "dist/knexfile.js" ] && [ ! -f "knexfile.ts" ]; then
    npx knex seed:run --knexfile dist/knexfile.js || { echo "[Entrypoint] Seeding failed!"; exit 1; }
  else
    npm run db:seed || { echo "[Entrypoint] Seeding failed!"; exit 1; }
  fi
fi

echo "[Entrypoint] Setup complete. Proceeding with command..."
exec "$@"
