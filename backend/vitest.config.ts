import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default run: unit tests only (fast, mocked DB, no real services needed)
    globals: false,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/*_e2e.test.ts'],
    env: {
      // Allow hotelContext without X-Hotel-Id in unit tests (non-production).
      ALLOW_DEFAULT_HOTEL: 'true',
    },
    projects: [
      {
        // Unit tests: mocked DB, ALLOW_DEFAULT_HOTEL enabled
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/*_e2e.test.ts'],
          environment: 'node',
          globals: false,
          env: {
            ALLOW_DEFAULT_HOTEL: 'true',
          },
        },
      },
      {
        // E2E / integration tests: real running API + real Postgres (via prod compose)
        // Run with: vitest --project=e2e
        // Requires: docker compose up (API on DB_HOST/DB_PORT) or running API locally
        test: {
          name: 'e2e',
          include: ['src/**/*_e2e.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          environment: 'node',
          globals: false,
          // No ALLOW_DEFAULT_HOTEL — X-Hotel-Id is required, matching prod behaviour
          testTimeout: 30000,
          hookTimeout: 30000,
          env: {
            // Override via environment when running in container
            DB_HOST: process.env.DB_HOST ?? 'localhost',
            DB_PORT: process.env.DB_PORT ?? '5432',
            DB_NAME: process.env.DB_NAME ?? 'hotel_pms_dev',
            DB_USER: process.env.DB_USER ?? 'postgres',
            DB_PASSWORD: process.env.DB_PASSWORD ?? 'postgres',
          },
        },
      },
    ],
  },
});
