import type { Knex } from 'knex';

/**
 * Update rooms table type constraint to accommodate QloApps room types
 * Adds 'General' and 'Other' to the existing constraint to allow for more room type variations
 */
export async function up(knex: Knex): Promise<void> {
  // Drop the existing constraint
  await knex.schema.raw(`
    ALTER TABLE rooms 
    DROP CONSTRAINT IF EXISTS check_rooms_type;
  `);

  // Add the updated constraint with more room types
  await knex.schema.raw(`
    ALTER TABLE rooms 
    ADD CONSTRAINT check_rooms_type 
    CHECK (type IN ('Single', 'Double', 'Suite', 'General', 'Other'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert to the original constraint
  await knex.schema.raw(`
    ALTER TABLE rooms 
    DROP CONSTRAINT IF EXISTS check_rooms_type;
  `);

  await knex.schema.raw(`
    ALTER TABLE rooms 
    ADD CONSTRAINT check_rooms_type 
    CHECK (type IN ('Single', 'Double', 'Suite'));
  `);
}

