import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Check if hotel settings already exist
  const existing = await knex('hotel_settings')
    .where({ id: '00000000-0000-0000-0000-000000000001' })
    .first();

  if (existing) {
    console.log('✅ Hotel settings already exist, skipping seed');
    return;
  }

  await knex('hotel_settings').insert({
    id: '00000000-0000-0000-0000-000000000001',
    hotel_name: 'Grand Hotel',
    address: '123 Main Street',
    city: 'New York',
    country: 'USA',
    phone: '+1 (555) 123-4567',
    email: 'info@grandhotel.com',
    tax_rate: 10.0,
    currency: 'USD',
    timezone: 'America/New_York',
    check_in_time: '15:00:00',
    check_out_time: '11:00:00',
    settings: JSON.stringify({
      booking_policy: 'Free cancellation up to 24 hours before check-in',
      amenities: ['WiFi', 'Parking', 'Breakfast'],
    }),
  });

  console.log('✅ Hotel settings seeded');
}

