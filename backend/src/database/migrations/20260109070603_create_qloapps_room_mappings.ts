import type { Knex } from 'knex';

/**
 * Create qloapps_room_mappings table
 * Maps individual QloApps hotel rooms to PMS rooms
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('qloapps_room_mappings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Property and QloApps identifiers
    table.uuid('property_id').notNullable()
      .comment('PMS property ID');
    table.string('qloapps_hotel_id', 50).notNullable()
      .comment('QloApps hotel ID');
    table.string('qloapps_room_id', 50).notNullable()
      .comment('QloApps hotel room ID');
    
    // PMS references
    table.uuid('local_room_id').notNullable()
      .references('id').inTable('rooms')
      .onDelete('CASCADE')
      .comment('PMS room ID');
    table.uuid('local_room_type_id').notNullable()
      .references('id').inTable('room_types')
      .onDelete('CASCADE')
      .comment('PMS room type ID');
    
    // Sync metadata
    table.boolean('is_active').defaultTo(true)
      .comment('Whether this mapping is currently active');
    table.timestamp('last_synced_at', { useTz: true }).nullable()
      .comment('Last successful sync timestamp');
    table.string('last_sync_status', 50).nullable()
      .comment('Status of last sync attempt');
    table.text('sync_notes').nullable()
      .comment('Notes from last sync');
    
    // Metadata
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Unique constraint: one QloApps room maps to one PMS room per property
  await knex.schema.raw(`
    ALTER TABLE qloapps_room_mappings
    ADD CONSTRAINT unique_qloapps_room_per_property
    UNIQUE (property_id, qloapps_room_id);
  `);

  // Unique constraint: one PMS room maps to one QloApps room
  await knex.schema.raw(`
    ALTER TABLE qloapps_room_mappings
    ADD CONSTRAINT unique_local_room
    UNIQUE (local_room_id);
  `);

  // Indexes for efficient lookups
  await knex.schema.raw(`
    CREATE INDEX idx_qloapps_room_mappings_property_id 
    ON qloapps_room_mappings(property_id);
    
    CREATE INDEX idx_qloapps_room_mappings_qloapps_room_id 
    ON qloapps_room_mappings(qloapps_room_id);
    
    CREATE INDEX idx_qloapps_room_mappings_local_room_id 
    ON qloapps_room_mappings(local_room_id);
    
    CREATE INDEX idx_qloapps_room_mappings_local_room_type_id 
    ON qloapps_room_mappings(local_room_type_id);
    
    CREATE INDEX idx_qloapps_room_mappings_is_active 
    ON qloapps_room_mappings(is_active) 
    WHERE is_active = true;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('qloapps_room_mappings');
}

