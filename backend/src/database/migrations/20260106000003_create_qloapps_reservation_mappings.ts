import type { Knex } from 'knex';

/**
 * Migration: Create QloApps Reservation Mappings Table
 *
 * Maps PMS reservations to QloApps order/booking IDs for booking synchronization.
 * This is the core table for managing booking flow between systems.
 *
 * QloApps uses "orders" for bookings in its PrestaShop-based architecture.
 * Each order in QloApps corresponds to a reservation in our PMS.
 *
 * QloApps Booking Status Codes:
 * - 1: NEW (awaiting confirmation)
 * - 2: COMPLETED (confirmed/checked-out)
 * - 3: CANCELLED
 * - 4: REFUNDED
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('qloapps_reservation_mappings', (table) => {
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

    // Local PMS reservation reference
    table
      .uuid('local_reservation_id')
      .notNullable()
      .references('id')
      .inTable('reservations')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // QloApps external identifiers
    // order_id in QloApps represents the booking
    table
      .string('qloapps_order_id', 50)
      .notNullable()
      .comment('QloApps order ID representing the booking');

    // QloApps booking reference (human-readable reference number)
    table
      .string('qloapps_reference', 100)
      .nullable()
      .comment('QloApps booking reference number for display');

    // QloApps hotel ID for multi-property QloApps setups
    table
      .string('qloapps_hotel_id', 50)
      .notNullable()
      .comment('QloApps hotel ID this reservation belongs to');

    // Source tracking: where did this reservation originate?
    table
      .enum('source', ['pms', 'qloapps', 'ota'])
      .notNullable()
      .defaultTo('qloapps')
      .comment('Origin of the reservation: PMS, QloApps, or OTA channel');

    // OTA channel info (if booked via OTA through QloApps)
    table
      .string('ota_channel', 50)
      .nullable()
      .comment('OTA channel name if booked via OTA (booking.com, expedia, airbnb)');

    table
      .string('ota_confirmation_number', 100)
      .nullable()
      .comment('OTA confirmation/booking number');

    // Status tracking
    table
      .boolean('is_active')
      .notNullable()
      .defaultTo(true)
      .comment('Whether this mapping is active (false for cancelled bookings)');

    // QloApps status code (for reference)
    table
      .integer('qloapps_status_code')
      .nullable()
      .comment('QloApps status code: 1=NEW, 2=COMPLETED, 3=CANCELLED, 4=REFUNDED');

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

    // Reservation hash for change detection
    table
      .string('local_hash', 64)
      .nullable()
      .comment('SHA256 hash of local reservation data for change detection');

    table
      .string('qloapps_hash', 64)
      .nullable()
      .comment('SHA256 hash of QloApps order data for change detection');

    // Metadata for additional QloApps booking info
    table
      .jsonb('metadata')
      .nullable()
      .comment('Additional QloApps order metadata (payment info, special requests, etc.)');

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
  // Unique constraint: One local reservation can only map to one QloApps order per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_reservation_mappings_local_unique 
    ON qloapps_reservation_mappings (property_id, local_reservation_id);
  `);

  // Unique constraint: One QloApps order can only map to one local reservation per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_reservation_mappings_qloapps_unique 
    ON qloapps_reservation_mappings (property_id, qloapps_order_id, qloapps_hotel_id);
  `);

  // Index for lookups by QloApps identifiers
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_reservation_mappings_qloapps_lookup 
    ON qloapps_reservation_mappings (qloapps_order_id, qloapps_hotel_id);
  `);

  // Index for OTA tracking queries
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_reservation_mappings_ota 
    ON qloapps_reservation_mappings (ota_channel, ota_confirmation_number) 
    WHERE ota_channel IS NOT NULL;
  `);

  // Partial index for active mappings
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_reservation_mappings_active 
    ON qloapps_reservation_mappings (property_id, source) 
    WHERE is_active = true;
  `);

  // Index for conflict resolution queue
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_reservation_mappings_conflicts 
    ON qloapps_reservation_mappings (property_id, created_at) 
    WHERE has_conflict = true;
  `);

  // Index by QloApps reference for human lookups
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_reservation_mappings_reference 
    ON qloapps_reservation_mappings (qloapps_reference) 
    WHERE qloapps_reference IS NOT NULL;
  `);

  // Add trigger for updated_at
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION update_qloapps_reservation_mappings_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_qloapps_reservation_mappings_updated_at
    BEFORE UPDATE ON qloapps_reservation_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_qloapps_reservation_mappings_updated_at();
  `);

  // Add check constraints
  await knex.schema.raw(`
    ALTER TABLE qloapps_reservation_mappings
    ADD CONSTRAINT chk_qloapps_reservation_mappings_sync_status
    CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed', 'partial'));
  `);

  await knex.schema.raw(`
    ALTER TABLE qloapps_reservation_mappings
    ADD CONSTRAINT chk_qloapps_reservation_mappings_status_code
    CHECK (qloapps_status_code IS NULL OR qloapps_status_code IN (1, 2, 3, 4));
  `);

  // Ensure OTA fields are set together
  await knex.schema.raw(`
    ALTER TABLE qloapps_reservation_mappings
    ADD CONSTRAINT chk_qloapps_reservation_mappings_ota_consistency
    CHECK (
      (source = 'ota' AND ota_channel IS NOT NULL) OR
      (source != 'ota')
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop trigger first
  await knex.schema.raw(`
    DROP TRIGGER IF EXISTS trigger_qloapps_reservation_mappings_updated_at ON qloapps_reservation_mappings;
    DROP FUNCTION IF EXISTS update_qloapps_reservation_mappings_updated_at();
  `);

  // Drop the table (this will also drop indexes and constraints)
  await knex.schema.dropTableIfExists('qloapps_reservation_mappings');
}
