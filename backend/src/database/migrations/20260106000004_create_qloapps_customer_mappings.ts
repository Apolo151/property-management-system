import type { Knex } from 'knex';

/**
 * Migration: Create QloApps Customer Mappings Table
 *
 * Maps PMS guests to QloApps customer IDs for guest profile synchronization.
 * Supports guest data sharing between systems for unified guest experience.
 *
 * QloApps uses "customers" in its PrestaShop-based architecture.
 * Each customer in QloApps corresponds to a guest in our PMS.
 *
 * Note: Guest matching is complex due to potential duplicates.
 * We use email as the primary matching key with fallback to phone.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('qloapps_customer_mappings', (table) => {
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

    // Local PMS guest reference
    table
      .uuid('local_guest_id')
      .notNullable()
      .references('id')
      .inTable('guests')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // QloApps external identifiers
    table
      .string('qloapps_customer_id', 50)
      .notNullable()
      .comment('QloApps customer ID');

    // QloApps hotel ID for multi-property QloApps setups
    table
      .string('qloapps_hotel_id', 50)
      .notNullable()
      .comment('QloApps hotel ID this customer is associated with');

    // Matching key used to establish this mapping
    table
      .enum('match_type', ['email', 'phone', 'manual', 'booking'])
      .notNullable()
      .defaultTo('email')
      .comment('How this mapping was established: email match, phone match, manual link, or via booking');

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

    table
      .boolean('is_verified')
      .notNullable()
      .defaultTo(false)
      .comment('Whether this mapping has been verified (auto-matches may need verification)');

    // Guest profile hash for change detection
    table
      .string('local_hash', 64)
      .nullable()
      .comment('SHA256 hash of local guest data for change detection');

    table
      .string('qloapps_hash', 64)
      .nullable()
      .comment('SHA256 hash of QloApps customer data for change detection');

    // Sync tracking
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

    // Metadata for additional QloApps customer info
    table
      .jsonb('metadata')
      .nullable()
      .comment('Additional QloApps customer metadata (loyalty points, preferences, etc.)');

    // Conflict resolution tracking
    table
      .boolean('has_conflict')
      .notNullable()
      .defaultTo(false)
      .comment('Whether there is an unresolved sync conflict');

    table
      .jsonb('conflict_data')
      .nullable()
      .comment('Details of the conflict for manual resolution');

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
  // Unique constraint: One local guest can only map to one QloApps customer per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_customer_mappings_local_unique 
    ON qloapps_customer_mappings (property_id, local_guest_id);
  `);

  // Unique constraint: One QloApps customer can only map to one local guest per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_customer_mappings_qloapps_unique 
    ON qloapps_customer_mappings (property_id, qloapps_customer_id, qloapps_hotel_id);
  `);

  // Index for lookups by QloApps identifiers
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_customer_mappings_qloapps_lookup 
    ON qloapps_customer_mappings (qloapps_customer_id, qloapps_hotel_id);
  `);

  // Partial index for active mappings
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_customer_mappings_active 
    ON qloapps_customer_mappings (property_id, sync_direction) 
    WHERE is_active = true;
  `);

  // Index for unverified mappings that need review
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_customer_mappings_unverified 
    ON qloapps_customer_mappings (property_id, match_type, created_at) 
    WHERE is_verified = false;
  `);

  // Index for conflict resolution queue
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_customer_mappings_conflicts 
    ON qloapps_customer_mappings (property_id, created_at) 
    WHERE has_conflict = true;
  `);

  // Add trigger for updated_at
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION update_qloapps_customer_mappings_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_qloapps_customer_mappings_updated_at
    BEFORE UPDATE ON qloapps_customer_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_qloapps_customer_mappings_updated_at();
  `);

  // Add check constraint for last_sync_status values
  await knex.schema.raw(`
    ALTER TABLE qloapps_customer_mappings
    ADD CONSTRAINT chk_qloapps_customer_mappings_sync_status
    CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed', 'partial'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop trigger first
  await knex.schema.raw(`
    DROP TRIGGER IF EXISTS trigger_qloapps_customer_mappings_updated_at ON qloapps_customer_mappings;
    DROP FUNCTION IF EXISTS update_qloapps_customer_mappings_updated_at();
  `);

  // Drop the table (this will also drop indexes and constraints)
  await knex.schema.dropTableIfExists('qloapps_customer_mappings');
}
