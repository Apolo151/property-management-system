import type { Knex } from 'knex';

/**
 * Add No-show to reservation status CHECK constraint (Feature 002).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE reservations DROP CONSTRAINT IF EXISTS check_reservations_status;
    ALTER TABLE reservations ADD CONSTRAINT check_reservations_status
    CHECK (status IN ('Confirmed', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE reservations DROP CONSTRAINT IF EXISTS check_reservations_status;
    ALTER TABLE reservations ADD CONSTRAINT check_reservations_status
    CHECK (status IN ('Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'));
  `);
}
