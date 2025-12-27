import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('webhook_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Beds24 event identifier (for idempotency)
    table.string('event_id', 255).notNullable().unique();
    
    // Event metadata
    table.string('event_type', 50).notNullable(); // booking.created, booking.modified, booking.cancelled, booking.deleted
    table.jsonb('payload').notNullable(); // Full webhook payload
    
    // Processing status
    table.boolean('processed').defaultTo(false);
    table.timestamp('processed_at', { useTz: true });
    table.text('error_message'); // Error if processing failed
    
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Indexes for webhook processing
  await knex.schema.raw(`
    CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
    CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);
    CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
    CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(processed, created_at) WHERE processed = false;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_events');
}

