import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: {
      // Allow hotelContext without X-Hotel-Id in unit tests (non-production).
      ALLOW_DEFAULT_HOTEL: 'true',
    },
  },
});
