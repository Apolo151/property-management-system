import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rooms', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('room_number', 50).notNullable().unique();
    table.string('type', 50).notNullable();
    table.string('status', 50).notNullable().defaultTo('Available');
    table.decimal('price_per_night', 10, 2).notNullable();
    table.integer('floor').notNullable();
    table.jsonb('features').defaultTo('[]');
    table.text('description');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Check constraints using raw SQL (Knex doesn't support .check() on ColumnBuilder)
  await knex.schema.raw(`
    ALTER TABLE rooms 
    ADD CONSTRAINT check_rooms_type 
    CHECK (type IN ('Single', 'Double', 'Suite'));
  `);

  await knex.schema.raw(`
    ALTER TABLE rooms 
    ADD CONSTRAINT check_rooms_status 
    CHECK (status IN ('Available', 'Occupied', 'Cleaning', 'Out of Service'));
  `);

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_rooms_status ON rooms(status);
    CREATE INDEX idx_rooms_type ON rooms(type);
    CREATE INDEX idx_rooms_room_number ON rooms(room_number);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rooms');
}

