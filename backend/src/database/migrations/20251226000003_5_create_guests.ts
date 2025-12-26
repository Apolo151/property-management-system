import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('guests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('email', 255);
    table.string('phone', 50);
    table.integer('past_stays').defaultTo(0);
    table.text('notes');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true });
  });

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_guests_email ON guests(email);
    CREATE INDEX idx_guests_phone ON guests(phone);
    CREATE INDEX idx_guests_name ON guests(name);
    CREATE INDEX idx_guests_deleted_at ON guests(deleted_at) WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guests');
}

