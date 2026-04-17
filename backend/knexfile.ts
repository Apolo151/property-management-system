import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isCompiled = __filename.endsWith('.js');
const ext = isCompiled ? 'js' : 'ts';
const migrationDir = isCompiled ? path.join(__dirname, 'src/database/migrations') : './src/database/migrations';
const seedDir = isCompiled ? path.join(__dirname, 'src/database/seeds') : './src/database/seeds';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'hotel_pms_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: migrationDir,
      tableName: 'knex_migrations',
      extension: ext,
      loadExtensions: [`.${ext}`],
    },
    seeds: {
      directory: seedDir,
      extension: ext,
      loadExtensions: [`.${ext}`],
    },
  },

  test: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME_TEST || 'hotel_pms_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: migrationDir,
      tableName: 'knex_migrations',
      extension: ext,
      loadExtensions: [`.${ext}`],
    },
    seeds: {
      directory: seedDir,
      extension: ext,
      loadExtensions: [`.${ext}`],
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'hotel_pms',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 5,
      max: 30,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000,
    },
    migrations: {
      directory: migrationDir,
      tableName: 'knex_migrations',
      extension: ext,
      loadExtensions: [`.${ext}`],
    },
    seeds: {
      directory: seedDir,
      extension: ext,
      loadExtensions: [`.${ext}`],
    },
  },
};

export default config;
