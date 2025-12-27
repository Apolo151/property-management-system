import type { Knex } from 'knex';

/**
 * Migration to add unit_id support to housekeeping table
 * This allows housekeeping to work with room type units (local only, not synced with Beds24)
 */
export async function up(knex: Knex): Promise<void> {
  // Add unit_id column for room type units (format: "roomTypeId-unit-index")
  await knex.schema.alterTable('housekeeping', (table) => {
    table
      .string('unit_id', 255)
      .nullable()
      .comment('Unit ID for room type units (format: roomTypeId-unit-index). Local only, not synced with Beds24.');
  });

  // Make room_id nullable to support unit-based housekeeping
  await knex.schema.raw(`
    ALTER TABLE housekeeping 
    ALTER COLUMN room_id DROP NOT NULL;
  `);

  // Drop the unique constraint on room_id since we can have multiple units
  // The unique constraint is created by .unique() in the original migration
  // We need to drop it by finding the constraint name
  await knex.schema.raw(`
    DO $$
    DECLARE
      constraint_name text;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'housekeeping'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND (
        SELECT attname FROM pg_attribute 
        WHERE attrelid = conrelid AND attnum = conkey[1]
      ) = 'room_id';
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE housekeeping DROP CONSTRAINT ' || quote_ident(constraint_name);
      END IF;
    END $$;
  `);

  // Add unique constraint on (room_id, unit_id) to prevent duplicates
  // Only one of room_id or unit_id should be set
  await knex.schema.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_housekeeping_room_id_unique 
    ON housekeeping(room_id) 
    WHERE room_id IS NOT NULL AND unit_id IS NULL;
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_housekeeping_unit_id_unique 
    ON housekeeping(unit_id) 
    WHERE unit_id IS NOT NULL AND room_id IS NULL;
  `);

  // Add index for unit_id lookups
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_housekeeping_unit_id_lookup ON housekeeping(unit_id) WHERE unit_id IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove unit_id column
  await knex.schema.alterTable('housekeeping', (table) => {
    table.dropColumn('unit_id');
  });

  // Restore room_id NOT NULL constraint (if no null values exist)
  await knex.schema.raw(`
    ALTER TABLE housekeeping 
    ALTER COLUMN room_id SET NOT NULL;
  `);

  // Restore unique constraint on room_id
  await knex.schema.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS housekeeping_room_id_unique ON housekeeping(room_id);
  `);

  // Drop unit_id indexes
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_housekeeping_unit_id;
    DROP INDEX IF EXISTS idx_housekeeping_unit_id_lookup;
  `);
}

