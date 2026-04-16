import type { Knex } from 'knex';

/**
 * Normalize legacy room_type values to canonical Beds24-style values.
 *
 * This keeps existing environments aligned with current API filters and
 * frontend option values (single/double/suite/kingBed style taxonomy).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE room_types
    SET room_type = CASE
      WHEN room_type = 'Single' THEN 'single'
      WHEN room_type = 'Double' THEN 'double'
      WHEN room_type = 'Suite' THEN 'suite'
      ELSE room_type
    END
    WHERE room_type IN ('Single', 'Double', 'Suite');
  `);

  await knex.raw(`
    UPDATE rooms
    SET room_type = CASE
      WHEN room_type = 'Single' THEN 'single'
      WHEN room_type = 'Double' THEN 'double'
      WHEN room_type = 'Suite' THEN 'suite'
      ELSE room_type
    END
    WHERE room_type IN ('Single', 'Double', 'Suite');
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // Irreversible data normalization migration.
}
