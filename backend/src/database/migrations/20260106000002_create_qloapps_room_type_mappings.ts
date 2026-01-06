import type { Knex } from 'knex';

/**
 * Migration: Create QloApps Room Type Mappings Table
 *
 * Maps PMS room types to QloApps product IDs for inventory synchronization.
 * Supports bidirectional sync with configurable direction per mapping.
 *
 * QloApps uses "products" to represent room types in its PrestaShop-based architecture.
 * Each product in QloApps corresponds to a room type in our PMS.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('qloapps_room_type_mappings', (table) => {
    // Primary key
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    // Property reference (for multi-property support)
    table
      .uuid('property_id')
      .notNullable()
      .references('id')
      .inTable('hotel_settings')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // Local PMS room type reference
    table
      .uuid('local_room_type_id')
      .notNullable()
      .references('id')
      .inTable('room_types')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // QloApps external identifiers
    // product_id in QloApps represents the room type
    table
      .string('qloapps_product_id', 50)
      .notNullable()
      .comment('QloApps product ID representing the room type');

    // QloApps hotel ID for multi-property QloApps setups
    table
      .string('qloapps_hotel_id', 50)
      .notNullable()
      .comment('QloApps hotel ID this room type belongs to');

    // Sync configuration
    table
      .enum('sync_direction', ['inbound', 'outbound', 'bidirectional'])
      .notNullable()
      .defaultTo('bidirectional')
      .comment('Direction of sync: inbound (QloApps→PMS), outbound (PMS→QloApps), or bidirectional');

    // Status tracking
    table
      .boolean('is_active')
      .notNullable()
      .defaultTo(true)
      .comment('Whether this mapping is active for sync operations');

    // Mapping metadata (store extra QloApps product info)
    table
      .jsonb('metadata')
      .nullable()
      .comment('Additional QloApps product metadata (name, description, etc.)');

    // Last sync tracking
    table
      .timestamp('last_synced_at', { useTz: true })
      .nullable()
      .comment('Last successful sync timestamp');

    table
      .string('last_sync_status', 20)
      .nullable()
      .comment('Status of last sync: success, failed, partial');

    table
      .text('last_sync_error')
      .nullable()
      .comment('Error message from last failed sync');

    // Audit timestamps
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  // Indexes for query optimization
  // Unique constraint: One local room type can only map to one QloApps product per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_room_type_mappings_local_unique 
    ON qloapps_room_type_mappings (property_id, local_room_type_id);
  `);

  // Unique constraint: One QloApps product can only map to one local room type per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_room_type_mappings_qloapps_unique 
    ON qloapps_room_type_mappings (property_id, qloapps_product_id, qloapps_hotel_id);
  `);

  // Partial index for active mappings (most common query pattern)
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_room_type_mappings_active 
    ON qloapps_room_type_mappings (property_id, sync_direction) 
    WHERE is_active = true;
  `);

  // Index for lookups by QloApps identifiers
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_room_type_mappings_qloapps_lookup 
    ON qloapps_room_type_mappings (qloapps_product_id, qloapps_hotel_id);
  `);

  // Add trigger for updated_at
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION update_qloapps_room_type_mappings_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_qloapps_room_type_mappings_updated_at
    BEFORE UPDATE ON qloapps_room_type_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_qloapps_room_type_mappings_updated_at();
  `);

  // Add check constraint for last_sync_status values
  await knex.schema.raw(`
    ALTER TABLE qloapps_room_type_mappings
    ADD CONSTRAINT chk_qloapps_room_type_mappings_sync_status
    CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed', 'partial'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop trigger first
  await knex.schema.raw(`
    DROP TRIGGER IF EXISTS trigger_qloapps_room_type_mappings_updated_at ON qloapps_room_type_mappings;
    DROP FUNCTION IF EXISTS update_qloapps_room_type_mappings_updated_at();
  `);

  // Drop the table (this will also drop indexes and constraints)
  await knex.schema.dropTableIfExists('qloapps_room_type_mappings');
}
