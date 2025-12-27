import type { Knex } from 'knex';

/**
 * Migration to update rooms table to match Beds24 schema
 */
export async function up(knex: Knex): Promise<void> {
  // Add Beds24-compatible fields to rooms table
  await knex.schema.alterTable('rooms', (table) => {
    // Room type - expand to match Beds24 enum
    table.string('room_type', 50).comment('Beds24 room type: single, double, twin, suite, etc.');
    
    // Quantity (number of units of this room type)
    table.integer('qty').defaultTo(1).comment('Number of units of this room type');
    
    // Pricing fields
    table.decimal('min_price', 10, 2).comment('Minimum price per night');
    table.decimal('max_price', 10, 2).comment('Maximum price per night');
    table.decimal('rack_rate', 10, 2).comment('Standard rack rate');
    table.decimal('cleaning_fee', 10, 2).defaultTo(0).comment('Cleaning fee');
    table.decimal('security_deposit', 10, 2).defaultTo(0).comment('Security deposit');
    
    // Capacity fields
    table.integer('max_people').comment('Maximum number of people');
    table.integer('max_adult').nullable().comment('Maximum number of adults (null = use max_people)');
    table.integer('max_children').nullable().comment('Maximum number of children (null = no distinction)');
    
    // Stay restrictions
    table.integer('min_stay').nullable().comment('Minimum stay in nights (1-365)');
    table.integer('max_stay').nullable().comment('Maximum stay in nights (1-365)');
    
    // Tax fields
    table.decimal('tax_percentage', 5, 2).nullable().comment('Tax percentage');
    table.decimal('tax_per_person', 10, 2).nullable().comment('Tax per person');
    
    // Additional fields
    table.integer('room_size').nullable().comment('Room size in square meters (1-2000)');
    table.string('highlight_color', 20).nullable().comment('Highlight color for display');
    table.integer('sell_priority').nullable().comment('Sell priority (1-100, null = hidden)');
    table.boolean('include_reports').defaultTo(true).comment('Include in reports');
    
    // Restriction strategy
    table.string('restriction_strategy', 20).nullable().comment('firstNight or stayThrough');
    
    // Overbooking protection
    table.string('overbooking_protection', 20).nullable().comment('room or property');
    table.integer('block_after_checkout_days').defaultTo(0).comment('Days to block after checkout (0-7)');
    
    // Control priority
    table.integer('control_priority').nullable().comment('Control priority (1-100, null = hidden)');
  });

  // Update existing room_type from type if needed
  await knex.schema.raw(`
    UPDATE rooms 
    SET room_type = CASE 
      WHEN type = 'Single' THEN 'single'
      WHEN type = 'Double' THEN 'double'
      WHEN type = 'Suite' THEN 'suite'
      ELSE 'double'
    END
    WHERE room_type IS NULL;
  `);

  // Set defaults for new fields
  await knex.schema.raw(`
    UPDATE rooms 
    SET 
      qty = COALESCE(qty, 1),
      max_people = COALESCE(max_people, CASE 
        WHEN type = 'Single' THEN 1
        WHEN type = 'Double' THEN 2
        WHEN type = 'Suite' THEN 4
        ELSE 2
      END),
      min_price = COALESCE(min_price, price_per_night),
      max_price = COALESCE(max_price, price_per_night),
      rack_rate = COALESCE(rack_rate, price_per_night)
    WHERE qty IS NULL OR max_people IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms', (table) => {
    table.dropColumn('room_type');
    table.dropColumn('qty');
    table.dropColumn('min_price');
    table.dropColumn('max_price');
    table.dropColumn('rack_rate');
    table.dropColumn('cleaning_fee');
    table.dropColumn('security_deposit');
    table.dropColumn('max_people');
    table.dropColumn('max_adult');
    table.dropColumn('max_children');
    table.dropColumn('min_stay');
    table.dropColumn('max_stay');
    table.dropColumn('tax_percentage');
    table.dropColumn('tax_per_person');
    table.dropColumn('room_size');
    table.dropColumn('highlight_color');
    table.dropColumn('sell_priority');
    table.dropColumn('include_reports');
    table.dropColumn('restriction_strategy');
    table.dropColumn('overbooking_protection');
    table.dropColumn('block_after_checkout_days');
    table.dropColumn('control_priority');
  });
}

