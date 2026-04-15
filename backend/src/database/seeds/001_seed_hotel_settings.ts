import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Check if any hotels already exist (skip if seed has run before)
  const existingCount = await knex('hotels').count('* as cnt').first();
  
  if (existingCount && (existingCount as any).cnt > 0) {
    console.log('✅ Hotels already exist, skipping seed');
    return;
  }

  // Create a default hotel for multi-property setup
  const hotelData = {
    hotel_name: 'Default Hotel',
    hotel_address: '123 Main Street',
    hotel_city: 'New Cairo',
    hotel_state: 'Cairo',
    hotel_country: 'Egypt',
    hotel_postal_code: '10001',
    hotel_phone: '+1 (555) 123-4567',
    hotel_email: 'info@defaulthotel.com',
    hotel_website: 'https://www.defaulthotel.com',
    hotel_logo_url: null,
    currency: 'USD',
    timezone: 'America/New_York',
    date_format: 'YYYY-MM-DD',
    time_format: 'HH:mm',
    check_in_time: '15:00:00',
    check_out_time: '11:00:00',
    tax_percentage: 10.0,
    settings: {
      active_channel_manager: 'qloapps',
      notifications_enabled: true,
    },
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  };

  // Insert hotel and get the ID
  const [hotelId] = await knex('hotels').insert(hotelData).returning('id');
  
  console.log(`✅ Default hotel seeded successfully with ID: ${hotelId}`);
}

