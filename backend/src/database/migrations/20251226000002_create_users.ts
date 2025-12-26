import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('role', 50).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login', { useTz: true });
    table.text('refresh_token');
    table.timestamp('refresh_token_expires_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true });
  });

  // Check constraint for role
  await knex.schema.raw(`
    ALTER TABLE users 
    ADD CONSTRAINT check_users_role 
    CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'MAINTENANCE', 'VIEWER'));
  `);

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_role ON users(role);
    CREATE INDEX idx_users_is_active ON users(is_active);
    CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}

