import knexLib from 'knex';
import type { Knex } from 'knex';
import pg from 'pg';
import knexConfig from '../../knexfile.js';

// =============================================================================
// PostgreSQL Type Parser Configuration
// =============================================================================
// Override the default DATE type parser (OID 1082) to return raw strings
// instead of JavaScript Date objects.
//
// WHY THIS IS NECESSARY:
// The postgres-date library (used by pg-types) parses DATE values like
// "2025-12-31" using LOCAL TIME: new Date(2025, 11, 31, 0, 0, 0)
//
// In timezones ahead of UTC (e.g., Africa/Cairo UTC+2), this creates:
//   Local: 2025-12-31 00:00:00 (Cairo)
//   UTC:   2025-12-30 22:00:00 (previous day!)
//
// When code later uses getUTCDate() to extract the date, it returns 30
// instead of 31, causing dates to shift back by one day.
//
// By returning the raw string "2025-12-31", we avoid all timezone issues
// and preserve the exact date value from PostgreSQL.
// =============================================================================
pg.types.setTypeParser(1082, (val: string) => val); // DATE → string (YYYY-MM-DD)

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

if (!config) {
  throw new Error(`No database configuration found for environment: ${environment}`);
}

const db: Knex = knexLib(config);

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ PostgreSQL database connected successfully');
  })
  .catch((err) => {
    console.error('❌ PostgreSQL database connection failed:', err.message);
    process.exit(1);
  });

export default db;
