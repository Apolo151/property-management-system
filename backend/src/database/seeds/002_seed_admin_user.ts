import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  // Check if admin user already exists
  const existing = await knex('users')
    .where({ email: 'admin@hotel.com' })
    .first();

  if (existing) {
    console.log('✅ Admin user already exists, skipping seed');
    return;
  }

  // Hash password: "admin123" (change in production!)
  const passwordHash = await bcrypt.hash('admin123', 10);

  await knex('users').insert({
    email: 'admin@hotel.com',
    password_hash: passwordHash,
    first_name: 'Admin',
    last_name: 'User',
    role: 'ADMIN',
    is_active: true,
  });

  console.log('✅ Admin user seeded');
  console.log('📧 Email: admin@hotel.com');
  console.log('🔑 Password: admin123');
  console.log('⚠️  Please change the password after first login!');
}

