import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reservation_guests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('reservation_id')
      .notNullable()
      .references('id')
      .inTable('reservations')
      .onDelete('CASCADE');
    table
      .uuid('guest_id')
      .notNullable()
      .references('id')
      .inTable('guests')
      .onDelete('RESTRICT');
    table
      .string('guest_type', 50)
      .notNullable()
      .defaultTo('Primary');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Check constraint
  await knex.schema.raw(`
    ALTER TABLE reservation_guests 
    ADD CONSTRAINT check_reservation_guests_type 
    CHECK (guest_type IN ('Primary', 'Secondary'));
  `);

  // Unique constraint - one guest can only be linked once per reservation
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_reservation_guests_unique 
    ON reservation_guests(reservation_id, guest_id);
  `);

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_reservation_guests_reservation_id ON reservation_guests(reservation_id);
    CREATE INDEX idx_reservation_guests_guest_id ON reservation_guests(guest_id);
    CREATE INDEX idx_reservation_guests_guest_type ON reservation_guests(guest_type);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reservation_guests');
}

