import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reservations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('room_id')
      .notNullable()
      .references('id')
      .inTable('rooms')
      .onDelete('RESTRICT');
    table
      .uuid('primary_guest_id')
      .notNullable()
      .references('id')
      .inTable('guests')
      .onDelete('RESTRICT');
    table.date('check_in').notNullable();
    table.date('check_out').notNullable();
    table
      .string('status', 50)
      .notNullable()
      .defaultTo('Confirmed');
    table.decimal('total_amount', 10, 2).notNullable();
    table
      .string('source', 50)
      .defaultTo('Direct');
    table.string('beds24_booking_id', 255);
    table.text('special_requests');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true });
  });

  // Check constraints
  await knex.schema.raw(`
    ALTER TABLE reservations 
    ADD CONSTRAINT check_reservations_status 
    CHECK (status IN ('Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'));
  `);

  await knex.schema.raw(`
    ALTER TABLE reservations 
    ADD CONSTRAINT check_reservations_source 
    CHECK (source IN ('Direct', 'Beds24', 'Booking.com', 'Expedia', 'Other'));
  `);

  await knex.schema.raw(`
    ALTER TABLE reservations 
    ADD CONSTRAINT check_reservations_dates 
    CHECK (check_out > check_in);
  `);

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_reservations_room_id ON reservations(room_id);
    CREATE INDEX idx_reservations_primary_guest_id ON reservations(primary_guest_id);
    CREATE INDEX idx_reservations_check_in ON reservations(check_in);
    CREATE INDEX idx_reservations_check_out ON reservations(check_out);
    CREATE INDEX idx_reservations_status ON reservations(status);
    CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);
    CREATE INDEX idx_reservations_beds24_booking_id ON reservations(beds24_booking_id);
    CREATE INDEX idx_reservations_deleted_at ON reservations(deleted_at) WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reservations');
}

