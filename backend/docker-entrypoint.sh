#!/bin/sh
set -e

echo "[Entrypoint] Initializing backend service..."

# Unless explicitly disabled, run database migrations on container startup
if [ "$RUN_MIGRATIONS" != "false" ]; then
  echo "[Entrypoint] Running database migrations..."
  npm run db:migrate || { echo "[Entrypoint] Migrations failed!"; exit 1; }
fi

# Run seeders only if explicitly requested, or if in development and not skipped
if [ "$RUN_SEEDS" = "true" ]; then
  echo "[Entrypoint] Running database seeds (manual override)..."
  npm run db:seed || { echo "[Entrypoint] Seeding failed!"; exit 1; }
elif [ "$NODE_ENV" != "production" ] && [ "$SKIP_SEEDS" != "true" ]; then
  echo "[Entrypoint] Running database seeds (development mode)..."
  npm run db:seed || { echo "[Entrypoint] Seeding failed!"; exit 1; }
fi

echo "[Entrypoint] Setup complete. Proceeding with command..."
exec "$@"
