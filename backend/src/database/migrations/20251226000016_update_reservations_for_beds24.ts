import type { Knex } from 'knex';

/**
 * Migration to update reservations table to match Beds24 booking schema
 */
export async function up(knex: Knex): Promise<void> {
  // Add Beds24-compatible fields to reservations table
  await knex.schema.alterTable('reservations', (table) => {
    // Booking group and master
    table.integer('beds24_master_id').nullable().comment('Beds24 master booking ID for grouped bookings');
    table.jsonb('beds24_booking_group').nullable().comment('Beds24 booking group IDs');
    
    // Unit and quantity
    table.integer('beds24_unit_id').nullable().comment('Beds24 unit ID');
    table.integer('room_qty').defaultTo(1).comment('Number of rooms/units');
    
    // Status fields
    table.string('sub_status', 50).nullable().comment('Beds24 sub status');
    table.integer('status_code').nullable().comment('Beds24 status code');
    
    // Guest counts
    table.integer('num_adult').nullable().comment('Number of adults');
    table.integer('num_child').nullable().defaultTo(0).comment('Number of children');
    
    // Location fields
    table.string('country', 100).nullable().comment('Guest country');
    table.string('country2', 100).nullable().comment('Guest country 2');
    
    // Time fields
    table.string('arrival_time', 50).nullable().comment('Arrival time');
    table.timestamp('booking_time', { useTz: true }).nullable().comment('When booking was created');
    table.timestamp('modified_time', { useTz: true }).nullable().comment('When booking was last modified');
    table.timestamp('cancel_time', { useTz: true }).nullable().comment('When booking was cancelled');
    
    // Text fields
    table.text('comments').nullable().comment('Comments');
    table.text('notes').nullable().comment('Internal notes');
    table.text('message').nullable().comment('Message');
    table.text('group_note').nullable().comment('Group note');
    
    // Custom fields (Beds24 supports custom1-10)
    table.string('custom1', 255).nullable();
    table.string('custom2', 255).nullable();
    table.string('custom3', 255).nullable();
    table.string('custom4', 255).nullable();
    table.string('custom5', 255).nullable();
    table.string('custom6', 255).nullable();
    table.string('custom7', 255).nullable();
    table.string('custom8', 255).nullable();
    table.string('custom9', 255).nullable();
    table.string('custom10', 255).nullable();
    
    // Flag fields
    table.string('flag_color', 20).nullable().comment('Flag color');
    table.string('flag_text', 100).nullable().comment('Flag text');
    
    // Channel and source fields
    table.string('channel', 50).nullable().comment('Booking channel');
    table.string('api_source', 100).nullable().comment('API source');
    table.integer('api_source_id').nullable().comment('API source ID');
    table.string('api_reference', 100).nullable().comment('API reference');
    table.string('referer', 255).nullable().comment('Referer');
    table.string('reference', 100).nullable().comment('Reference');
    
    // Language
    table.string('lang', 10).nullable().comment('Language code');
    
    // Voucher
    table.string('voucher', 100).nullable().comment('Voucher code');
    
    // Pricing breakdown
    table.decimal('deposit', 10, 2).nullable().comment('Deposit amount');
    table.decimal('tax', 10, 2).nullable().comment('Tax amount');
    table.decimal('commission', 10, 2).nullable().comment('Commission amount');
    table.string('rate_description', 255).nullable().comment('Rate description');
    
    // Offer
    table.integer('offer_id').nullable().comment('Beds24 offer ID');
    
    // Allow flags
    table.string('allow_channel_update', 20).nullable().comment('Allow channel updates');
    table.string('allow_auto_action', 20).nullable().comment('Allow auto actions');
    table.string('allow_review', 20).nullable().comment('Allow review');
    
    // Cancellation settings (stored as JSONB)
    table.jsonb('allow_cancellation').nullable().comment('Cancellation settings');
    
    // Invoice and info items (stored as JSONB arrays)
    table.jsonb('invoice_items').nullable().comment('Invoice items');
    table.jsonb('info_items').nullable().comment('Info items');
  });

  // Create indexes for new fields
  await knex.schema.raw(`
    CREATE INDEX idx_reservations_beds24_master_id ON reservations(beds24_master_id);
    CREATE INDEX idx_reservations_channel ON reservations(channel);
    CREATE INDEX idx_reservations_api_reference ON reservations(api_reference);
    CREATE INDEX idx_reservations_booking_time ON reservations(booking_time);
    CREATE INDEX idx_reservations_modified_time ON reservations(modified_time);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop indexes
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_reservations_beds24_master_id;
    DROP INDEX IF EXISTS idx_reservations_channel;
    DROP INDEX IF EXISTS idx_reservations_api_reference;
    DROP INDEX IF EXISTS idx_reservations_booking_time;
    DROP INDEX IF EXISTS idx_reservations_modified_time;
  `);

  // Drop columns
  await knex.schema.alterTable('reservations', (table) => {
    table.dropColumn('beds24_master_id');
    table.dropColumn('beds24_booking_group');
    table.dropColumn('beds24_unit_id');
    table.dropColumn('room_qty');
    table.dropColumn('sub_status');
    table.dropColumn('status_code');
    table.dropColumn('num_adult');
    table.dropColumn('num_child');
    table.dropColumn('country');
    table.dropColumn('country2');
    table.dropColumn('arrival_time');
    table.dropColumn('booking_time');
    table.dropColumn('modified_time');
    table.dropColumn('cancel_time');
    table.dropColumn('comments');
    table.dropColumn('notes');
    table.dropColumn('message');
    table.dropColumn('group_note');
    table.dropColumn('custom1');
    table.dropColumn('custom2');
    table.dropColumn('custom3');
    table.dropColumn('custom4');
    table.dropColumn('custom5');
    table.dropColumn('custom6');
    table.dropColumn('custom7');
    table.dropColumn('custom8');
    table.dropColumn('custom9');
    table.dropColumn('custom10');
    table.dropColumn('flag_color');
    table.dropColumn('flag_text');
    table.dropColumn('channel');
    table.dropColumn('api_source');
    table.dropColumn('api_source_id');
    table.dropColumn('api_reference');
    table.dropColumn('referer');
    table.dropColumn('reference');
    table.dropColumn('lang');
    table.dropColumn('voucher');
    table.dropColumn('deposit');
    table.dropColumn('tax');
    table.dropColumn('commission');
    table.dropColumn('rate_description');
    table.dropColumn('offer_id');
    table.dropColumn('allow_channel_update');
    table.dropColumn('allow_auto_action');
    table.dropColumn('allow_review');
    table.dropColumn('allow_cancellation');
    table.dropColumn('invoice_items');
    table.dropColumn('info_items');
  });
}

