import type { Knex } from 'knex';

/**
 * Migration: Create QloApps Sync Logs Table
 *
 * Detailed logging for individual sync operations for:
 * - Debugging sync issues
 * - Audit trail of all changes
 * - Performance monitoring
 * - Compliance and reporting
 *
 * Each row represents a single entity sync operation (one reservation, one room type, etc.)
 * This is a high-volume table - consider partitioning or archival strategy for production.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('qloapps_sync_logs', (table) => {
    // Primary key
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    // Property reference
    table
      .uuid('property_id')
      .notNullable()
      .references('id')
      .inTable('hotel_settings')
      .onDelete('CASCADE')
      .onUpdate('CASCADE');

    // Reference to parent sync state (batch operation)
    table
      .uuid('sync_state_id')
      .nullable()
      .references('id')
      .inTable('qloapps_sync_state')
      .onDelete('SET NULL')
      .onUpdate('CASCADE')
      .comment('Reference to the batch sync operation');

    // Operation details
    table
      .string('operation', 30)
      .notNullable()
      .comment('Operation type: create, update, delete, fetch, push');

    table
      .string('entity_type', 30)
      .notNullable()
      .comment('Entity type: reservation, room_type, customer, availability, rate');

    table
      .string('direction', 10)
      .notNullable()
      .comment('Sync direction: inbound (QloApps→PMS) or outbound (PMS→QloApps)');

    // Entity identifiers
    table
      .uuid('local_entity_id')
      .nullable()
      .comment('Local PMS entity ID (reservation, room_type, or guest ID)');

    table
      .string('qloapps_entity_id', 50)
      .nullable()
      .comment('QloApps entity ID (order_id, product_id, or customer_id)');

    // Status
    table
      .string('status', 20)
      .notNullable()
      .comment('Status: success, failed, skipped, conflict');

    // Timing
    table
      .timestamp('started_at', { useTz: true })
      .notNullable()
      .comment('When this individual operation started');

    table
      .timestamp('completed_at', { useTz: true })
      .nullable()
      .comment('When this operation completed');

    table
      .integer('duration_ms')
      .nullable()
      .comment('Duration of this operation in milliseconds');

    // Request/Response details (for debugging)
    table
      .string('api_endpoint', 255)
      .nullable()
      .comment('QloApps API endpoint called');

    table
      .string('http_method', 10)
      .nullable()
      .comment('HTTP method: GET, POST, PUT, DELETE');

    table
      .integer('http_status_code')
      .nullable()
      .comment('HTTP response status code');

    // Data snapshots for debugging and audit
    table
      .jsonb('request_payload')
      .nullable()
      .comment('Request payload sent to QloApps (sanitized)');

    table
      .jsonb('response_data')
      .nullable()
      .comment('Response data from QloApps (sanitized)');

    table
      .jsonb('local_data_before')
      .nullable()
      .comment('Local entity state before the operation');

    table
      .jsonb('local_data_after')
      .nullable()
      .comment('Local entity state after the operation');

    // Error details
    table
      .string('error_code', 50)
      .nullable()
      .comment('Error code for categorization');

    table
      .text('error_message')
      .nullable()
      .comment('Error message if operation failed');

    table
      .text('error_stack')
      .nullable()
      .comment('Error stack trace for debugging');

    // Change tracking
    table
      .jsonb('changes')
      .nullable()
      .comment('Summary of changes made (field-level diff)');

    table
      .integer('fields_updated')
      .nullable()
      .comment('Number of fields updated');

    // Retry tracking
    table
      .boolean('is_retry')
      .notNullable()
      .defaultTo(false)
      .comment('Whether this is a retry of a previous failed operation');

    table
      .uuid('retry_of_log_id')
      .nullable()
      .comment('Reference to the original failed log entry');

    table
      .integer('retry_attempt')
      .notNullable()
      .defaultTo(0)
      .comment('Retry attempt number (0 = original attempt)');

    // Conflict tracking
    table
      .boolean('had_conflict')
      .notNullable()
      .defaultTo(false)
      .comment('Whether a conflict was detected');

    table
      .string('conflict_resolution', 30)
      .nullable()
      .comment('How conflict was resolved: local_wins, remote_wins, merged, manual');

    // Metadata
    table
      .jsonb('metadata')
      .nullable()
      .comment('Additional operation context');

    // Audit timestamp
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  // Indexes for common query patterns

  // Index for finding logs by sync state (batch lookup)
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_sync_state 
    ON qloapps_sync_logs (sync_state_id) 
    WHERE sync_state_id IS NOT NULL;
  `);

  // Index for property + time-based queries (most common)
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_property_time 
    ON qloapps_sync_logs (property_id, created_at DESC);
  `);

  // Index for entity-specific lookups
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_local_entity 
    ON qloapps_sync_logs (entity_type, local_entity_id) 
    WHERE local_entity_id IS NOT NULL;
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_qloapps_entity 
    ON qloapps_sync_logs (entity_type, qloapps_entity_id) 
    WHERE qloapps_entity_id IS NOT NULL;
  `);

  // Index for failed operations (for retry queue and debugging)
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_failed 
    ON qloapps_sync_logs (property_id, entity_type, created_at DESC) 
    WHERE status = 'failed';
  `);

  // Index for conflicts needing attention
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_conflicts 
    ON qloapps_sync_logs (property_id, created_at DESC) 
    WHERE had_conflict = true;
  `);

  // Index for operation type filtering
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_operation 
    ON qloapps_sync_logs (operation, entity_type, direction);
  `);

  // Index for cleanup/archival of old logs
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_sync_logs_created_at 
    ON qloapps_sync_logs (created_at);
  `);

  // Add check constraints
  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_logs 
    ADD CONSTRAINT chk_qloapps_sync_logs_status 
    CHECK (status IN ('success', 'failed', 'skipped', 'conflict'));
  `);

  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_logs 
    ADD CONSTRAINT chk_qloapps_sync_logs_operation 
    CHECK (operation IN ('create', 'update', 'delete', 'fetch', 'push', 'skip'));
  `);

  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_logs 
    ADD CONSTRAINT chk_qloapps_sync_logs_entity_type 
    CHECK (entity_type IN ('reservation', 'room_type', 'customer', 'availability', 'rate'));
  `);

  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_logs 
    ADD CONSTRAINT chk_qloapps_sync_logs_direction 
    CHECK (direction IN ('inbound', 'outbound'));
  `);

  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_logs 
    ADD CONSTRAINT chk_qloapps_sync_logs_http_method 
    CHECK (http_method IS NULL OR http_method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'));
  `);

  await knex.schema.raw(`
    ALTER TABLE qloapps_sync_logs 
    ADD CONSTRAINT chk_qloapps_sync_logs_conflict_resolution 
    CHECK (conflict_resolution IS NULL OR conflict_resolution IN ('local_wins', 'remote_wins', 'merged', 'manual', 'skipped'));
  `);

  // Add table comment for maintenance guidance
  await knex.schema.raw(`
    COMMENT ON TABLE qloapps_sync_logs IS 
    'High-volume sync operation logs. Consider implementing partitioning by created_at or archival strategy for production (retain 30-90 days of detailed logs).';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('qloapps_sync_logs');
}
