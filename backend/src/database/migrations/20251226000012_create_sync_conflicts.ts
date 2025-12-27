import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sync_conflicts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Reference to reservation (nullable if conflict is for other entities)
    table
      .uuid('reservation_id')
      .references('id')
      .inTable('reservations')
      .onDelete('CASCADE');
    
    // Beds24 booking identifier
    table.string('beds24_booking_id', 255);
    
    // Conflict metadata
    table.string('conflict_type', 50).notNullable(); // TIMESTAMP_CONFLICT, STATUS_CONFLICT, DATE_CONFLICT, AMOUNT_CONFLICT
    table.jsonb('pms_data').notNullable(); // PMS state snapshot
    table.jsonb('beds24_data').notNullable(); // Beds24 state snapshot
    
    // Resolution tracking
    table
      .string('resolution_strategy', 50)
      .defaultTo('MANUAL')
      .notNullable();
    table
      .uuid('resolved_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('resolved_at', { useTz: true });
    table.text('resolution_action'); // Description of resolution
    
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Check constraint for resolution_strategy
  await knex.schema.raw(`
    ALTER TABLE sync_conflicts 
    ADD CONSTRAINT check_sync_conflicts_resolution_strategy 
    CHECK (resolution_strategy IN ('AUTO', 'MANUAL', 'RESOLVED'));
  `);

  // Indexes for conflict queries
  await knex.schema.raw(`
    CREATE INDEX idx_sync_conflicts_reservation_id ON sync_conflicts(reservation_id);
    CREATE INDEX idx_sync_conflicts_beds24_booking_id ON sync_conflicts(beds24_booking_id);
    CREATE INDEX idx_sync_conflicts_resolution_strategy ON sync_conflicts(resolution_strategy, created_at);
    CREATE INDEX idx_sync_conflicts_conflict_type ON sync_conflicts(conflict_type);
    CREATE INDEX idx_sync_conflicts_unresolved ON sync_conflicts(resolution_strategy) WHERE resolution_strategy = 'MANUAL';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sync_conflicts');
}

