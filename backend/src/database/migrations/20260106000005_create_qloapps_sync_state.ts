import type { Knex } from 'knex';

/**
 * Migration: Create QloApps Sync State Table
 *
 * Tracks the state of QloApps sync operations including:
 * - Distributed locking to prevent concurrent syncs
 * - Last successful sync timestamps for incremental syncs
 * - Exponential backoff on failures
 * - Detailed statistics per sync type
 *
 * QloApps Sync Types:
 * - qloapps_room_types_pull: Fetch room types from QloApps
 * - qloapps_room_types_push: Push room types to QloApps
 * - qloapps_reservations_pull: Fetch bookings from QloApps (OTA bookings)
 * - qloapps_reservations_push: Push reservations to QloApps
 * - qloapps_availability_push: Push availability/inventory to QloApps
 * - qloapps_rates_push: Push rates/pricing to QloApps
 * - qloapps_customers_pull: Fetch customer data from QloApps
 * - qloapps_customers_push: Push guest data to QloApps
 * - qloapps_full_sync: Full bidirectional sync
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('qloapps_sync_state', (table) => {
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

    // Type of sync operation
    table
      .string('sync_type', 50)
      .notNullable()
      .comment('Type of sync: qloapps_reservations_pull, qloapps_availability_push, etc.');

    // Current status
    table
      .string('status', 20)
      .notNullable()
      .comment('Status: pending, running, completed, failed, cancelled');

    // Timing
    table
      .timestamp('started_at', { useTz: true })
      .notNullable()
      .comment('When the sync operation started');

    table
      .timestamp('completed_at', { useTz: true })
      .nullable()
      .comment('When the sync operation completed (success or failure)');

    // Last successful sync timestamp (used for incremental syncs)
    table
      .timestamp('last_successful_sync', { useTz: true })
      .nullable()
      .comment('Timestamp of last successful sync for this type');

    // Cursor for pagination (QloApps API returns paginated results)
    table
      .string('cursor', 255)
      .nullable()
      .comment('Pagination cursor for resumable syncs');

    // Statistics - Reservations
    table
      .integer('reservations_processed')
      .notNullable()
      .defaultTo(0)
      .comment('Total reservations processed in this sync');

    table
      .integer('reservations_created')
      .notNullable()
      .defaultTo(0)
      .comment('New reservations created');

    table
      .integer('reservations_updated')
      .notNullable()
      .defaultTo(0)
      .comment('Existing reservations updated');

    table
      .integer('reservations_failed')
      .notNullable()
      .defaultTo(0)
      .comment('Reservations that failed to sync');

    // Statistics - Room Types
    table
      .integer('room_types_processed')
      .notNullable()
      .defaultTo(0)
      .comment('Total room types processed');

    table
      .integer('room_types_synced')
      .notNullable()
      .defaultTo(0)
      .comment('Room types successfully synced');

    // Statistics - Customers
    table
      .integer('customers_processed')
      .notNullable()
      .defaultTo(0)
      .comment('Total customers processed');

    table
      .integer('customers_synced')
      .notNullable()
      .defaultTo(0)
      .comment('Customers successfully synced');

    // Statistics - Availability/Rates
    table
      .integer('availability_updates')
      .notNullable()
      .defaultTo(0)
      .comment('Number of availability updates sent');

    table
      .integer('rate_updates')
      .notNullable()
      .defaultTo(0)
      .comment('Number of rate updates sent');

    // Performance
    table
      .integer('duration_ms')
      .nullable()
      .comment('Total duration of sync in milliseconds');

    table
      .integer('api_calls_made')
      .notNullable()
      .defaultTo(0)
      .comment('Number of QloApps API calls made');

    // Error handling
    table
      .text('error_message')
      .nullable()
      .comment('Error message if sync failed');

    table
      .string('error_code', 50)
      .nullable()
      .comment('Error code for categorization');

    table
      .timestamp('next_retry_at', { useTz: true })
      .nullable()
      .comment('When to retry if failed (exponential backoff)');

    table
      .integer('retry_count')
      .notNullable()
      .defaultTo(0)
      .comment('Number of retry attempts');

    table
      .integer('max_retries')
      .notNullable()
      .defaultTo(5)
      .comment('Maximum retry attempts before giving up');

    // Triggering info
    table
      .enum('trigger_source', ['scheduled', 'manual', 'webhook', 'event'])
      .notNullable()
      .defaultTo('scheduled')
      .comment('What triggered this sync');

    table
      .uuid('triggered_by_user_id')
      .nullable()
      .comment('User ID if manually triggered');

    // Lock mechanism for preventing concurrent syncs
    table
      .string('lock_id', 100)
      .nullable()
      .comment('Unique lock ID for this sync instance');

    table
      .timestamp('lock_expires_at', { useTz: true })
      .nullable()
      .comment('When the lock expires (stale lock detection)');

    // Metadata
    table
      .jsonb('metadata')
      .nullable()
      .comment('Additional sync details (filters, options, etc.)');

    table
      .jsonb('summary')
      .nullable()
      .comment('Summary of sync results for reporting');

    // Audit timestamp
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  // Index for finding running syncs (lock mechanism) - only one running sync per type per property
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_qloapps_sync_state_running_lock 
    ON qloapps_sync_state (property_id, sync_type) 
    WHERE status = 'running';
  `);

  // Index for finding last successful sync
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_state_last_successful 
    ON qloapps_sync_state (property_id, sync_type, completed_at DESC) 
    WHERE status = 'completed';
  `);

  // Index for pending retries
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_state_pending_retries 
    ON qloapps_sync_state (next_retry_at, retry_count) 
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;
  `);

  // Index for cleanup of old records
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_state_created_at 
    ON qloapps_sync_state (created_at);
  `);

  // Index for stale lock detection
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_state_stale_locks 
    ON qloapps_sync_state (lock_expires_at) 
    WHERE status = 'running' AND lock_expires_at IS NOT NULL;
  `);

  // Add check constraint for status
  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_state 
    ADD CONSTRAINT chk_qloapps_sync_state_status 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
  `);

  // Add check constraint for valid sync types
  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_state 
    ADD CONSTRAINT chk_qloapps_sync_state_sync_type 
    CHECK (sync_type IN (
      'qloapps_room_types_pull',
      'qloapps_room_types_push',
      'qloapps_reservations_pull',
      'qloapps_reservations_push',
      'qloapps_availability_push',
      'qloapps_rates_push',
      'qloapps_customers_pull',
      'qloapps_customers_push',
      'qloapps_full_sync'
    ));
  `);

  // Add check constraint for retry count
  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_state 
    ADD CONSTRAINT chk_qloapps_sync_state_retry_count 
    CHECK (retry_count >= 0 AND retry_count <= max_retries);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('qloapps_sync_state');
}
