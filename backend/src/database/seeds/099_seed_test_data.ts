import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Test data seed — creates comprehensive data for e2e tests.
 * Idempotent: skips each section if a sentinel record already exists.
 * Run after 001 and 002 seeds.
 */
export async function seed(knex: Knex): Promise<void> {
  // ── 1. Resolve default hotel ──────────────────────────────────────────────
  const defaultHotel = await knex('hotels').select('id').first();
  if (!defaultHotel) {
    console.log('⚠️  No hotels found — run 001_seed_hotel_settings first');
    return;
  }
  const hotelId: string = defaultHotel.id;
  console.log(`✅ Using default hotel: ${hotelId}`);

  // ── 2. Second hotel (tenancy isolation tests) ─────────────────────────────
  let hotelBId: string;
  const existingB = await knex('hotels').where({ hotel_name: 'Test Hotel B' }).first();
  if (existingB) {
    hotelBId = existingB.id;
    console.log('✅ Test Hotel B already exists, skipping');
  } else {
    const [newHotelB] = await knex('hotels')
      .insert({
        hotel_name: 'Test Hotel B',
        hotel_address: '456 Test Avenue',
        hotel_city: 'Test City',
        hotel_state: 'Test State',
        hotel_country: 'Egypt',
        hotel_postal_code: '20002',
        hotel_phone: '+1 (555) 999-0000',
        hotel_email: 'info@testhotelb.com',
        hotel_website: 'https://www.testhotelb.com',
        hotel_logo_url: null,
        currency: 'USD',
        timezone: 'America/New_York',
        date_format: 'YYYY-MM-DD',
        time_format: 'HH:mm',
        check_in_time: '15:00:00',
        check_out_time: '11:00:00',
        tax_percentage: 10.0,
        settings: { active_channel_manager: null, notifications_enabled: true },
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .returning('id');
    hotelBId = newHotelB.id ?? newHotelB;
    console.log(`✅ Test Hotel B seeded: ${hotelBId}`);
  }

  // ── 3. Test users (one per role) ──────────────────────────────────────────
  const TEST_USERS = [
    { email: 'manager@testhotel.com', role: 'MANAGER', first_name: 'Test', last_name: 'Manager' },
    { email: 'frontdesk@testhotel.com', role: 'FRONT_DESK', first_name: 'Test', last_name: 'FrontDesk' },
    { email: 'housekeeping@testhotel.com', role: 'HOUSEKEEPING', first_name: 'Test', last_name: 'Housekeeping' },
    { email: 'maintenance@testhotel.com', role: 'MAINTENANCE', first_name: 'Test', last_name: 'Maintenance' },
    { email: 'viewer@testhotel.com', role: 'VIEWER', first_name: 'Test', last_name: 'Viewer' },
  ];
  const passwordHash = await bcrypt.hash('test1234', 10);

  const userIds: Record<string, string> = {};
  for (const u of TEST_USERS) {
    const existing = await knex('users').where({ email: u.email }).first();
    if (existing) {
      userIds[u.role] = existing.id;
    } else {
      const [row] = await knex('users')
        .insert({ ...u, password_hash: passwordHash, is_active: true })
        .returning('id');
      userIds[u.role] = row.id ?? row;
    }
  }
  // Get admin id too
  const adminUser = await knex('users').where({ email: 'admin@hotel.com' }).first();
  if (adminUser) userIds['SUPER_ADMIN'] = adminUser.id;

  // Assign test users to default hotel (user_hotels junction)
  for (const uid of Object.values(userIds)) {
    const exists = await knex('user_hotels').where({ user_id: uid, hotel_id: hotelId }).first();
    if (!exists) {
      await knex('user_hotels').insert({ user_id: uid, hotel_id: hotelId });
    }
  }
  console.log(`✅ Test users seeded (${TEST_USERS.length} roles)`);

  // ── 4. Room types ─────────────────────────────────────────────────────────
  const ROOM_TYPE_DEFS = [
    { name: 'Standard Single', max_adult: 1, max_children: 0, price_per_night: 80.00, description: 'Cozy single room', room_type: 'single', qty: 5 },
    { name: 'Standard Double', max_adult: 2, max_children: 1, price_per_night: 120.00, description: 'Comfortable double room', room_type: 'double', qty: 5 },
    { name: 'King Bed', max_adult: 2, max_children: 1, price_per_night: 150.00, description: 'Spacious king bed room', room_type: 'kingBed', qty: 2 },
    { name: 'Deluxe Suite', max_adult: 2, max_children: 2, price_per_night: 200.00, description: 'Luxurious suite', room_type: 'suite', qty: 2 },
  ];
  const roomTypeIds: Record<string, string> = {};
  for (const rt of ROOM_TYPE_DEFS) {
    const existing = await knex('room_types').where({ hotel_id: hotelId, name: rt.name }).first();
    if (existing) {
      roomTypeIds[rt.name] = existing.id;
    } else {
      const [row] = await knex('room_types')
        .insert({ ...rt, hotel_id: hotelId, created_at: knex.fn.now(), updated_at: knex.fn.now() })
        .returning('id');
      roomTypeIds[rt.name] = row.id ?? row;
    }
  }
  console.log('✅ Room types seeded');

  // ── 5. Rooms ──────────────────────────────────────────────────────────────
  const ROOM_DEFS = [
    { room_number: '101', floor: 1, status: 'Available', type: 'Single', room_type: 'single', price_per_night: 80.00, room_type_id: roomTypeIds['Standard Single'] },
    { room_number: '102', floor: 1, status: 'Available', type: 'Single', room_type: 'single', price_per_night: 80.00, room_type_id: roomTypeIds['Standard Single'] },
    { room_number: '103', floor: 1, status: 'Cleaning',  type: 'Single', room_type: 'single', price_per_night: 80.00, room_type_id: roomTypeIds['Standard Single'] },
    { room_number: '201', floor: 2, status: 'Available', type: 'Double', room_type: 'double', price_per_night: 120.00, room_type_id: roomTypeIds['Standard Double'] },
    { room_number: '202', floor: 2, status: 'Out of Service', type: 'Double', room_type: 'double', price_per_night: 120.00, room_type_id: roomTypeIds['Standard Double'] },
    { room_number: '203', floor: 2, status: 'Available', type: 'Double', room_type: 'kingBed', price_per_night: 150.00, room_type_id: roomTypeIds['King Bed'] },
    { room_number: '204', floor: 2, status: 'Available', type: 'Double', room_type: 'kingBed', price_per_night: 150.00, room_type_id: roomTypeIds['King Bed'] },
    { room_number: '301', floor: 3, status: 'Available', type: 'Suite', room_type: 'suite', price_per_night: 200.00, room_type_id: roomTypeIds['Deluxe Suite'] },
  ];
  const roomIds: Record<string, string> = {};
  for (const r of ROOM_DEFS) {
    const existing = await knex('rooms').where({ hotel_id: hotelId, room_number: r.room_number }).first();
    if (existing) {
      roomIds[r.room_number] = existing.id;
    } else {
      const [row] = await knex('rooms')
        .insert({ ...r, hotel_id: hotelId, created_at: knex.fn.now(), updated_at: knex.fn.now() })
        .returning('id');
      roomIds[r.room_number] = row.id ?? row;
    }
  }
  console.log('✅ Rooms seeded');

  // ── 6. Guests ─────────────────────────────────────────────────────────────
  const GUESTS = [
    { name: 'Alice Smith',   email: 'alice.smith@test.com',   phone: '+1-555-0001' },
    { name: 'Bob Jones',     email: 'bob.jones@test.com',     phone: '+1-555-0002' },
    { name: 'Carol White',   email: 'carol.white@test.com',   phone: '+1-555-0003' },
    { name: 'Dave Brown',    email: 'dave.brown@test.com',    phone: '+1-555-0004' },
    { name: 'Eve Taylor',    email: 'eve.taylor@test.com',    phone: '+1-555-0005' },
  ];
  const guestIds: string[] = [];
  for (const g of GUESTS) {
    const existing = await knex('guests').where({ hotel_id: hotelId, email: g.email }).first();
    if (existing) {
      guestIds.push(existing.id);
    } else {
      const [row] = await knex('guests')
        .insert({ ...g, hotel_id: hotelId, created_at: knex.fn.now(), updated_at: knex.fn.now() })
        .returning('id');
      guestIds.push(row.id ?? row);
    }
  }
  console.log('✅ Guests seeded');

  // ── 7. Reservations ───────────────────────────────────────────────────────
  // We need dates relative to today
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  const RESERVATIONS = [
    // Future confirmed
    {
      key: 'confirmed-future',
      primary_guest_id: guestIds[0],
      room_type_id: roomTypeIds['Standard Single'],
      check_in: fmt(addDays(today, 5)),
      check_out: fmt(addDays(today, 8)),
      status: 'Confirmed',
      total_amount: 240.00,
      source: 'Direct',
    },
    // Confirmed — ready-to-checkin (today)
    {
      key: 'confirmed-today',
      primary_guest_id: guestIds[1],
      room_type_id: roomTypeIds['Standard Double'],
      check_in: fmt(today),
      check_out: fmt(addDays(today, 3)),
      status: 'Confirmed',
      total_amount: 360.00,
      source: 'Direct',
    },
    // Already checked in (room 102 occupied)
    {
      key: 'checkedin',
      primary_guest_id: guestIds[2],
      room_type_id: roomTypeIds['Standard Single'],
      check_in: fmt(addDays(today, -1)),
      check_out: fmt(addDays(today, 2)),
      status: 'Checked-in',
      total_amount: 160.00,
      source: 'Direct',
    },
    // Checked out (past)
    {
      key: 'checkedout',
      primary_guest_id: guestIds[3],
      room_type_id: roomTypeIds['Deluxe Suite'],
      check_in: fmt(addDays(today, -5)),
      check_out: fmt(addDays(today, -2)),
      status: 'Checked-out',
      total_amount: 600.00,
      source: 'Direct',
    },
    // Cancelled
    {
      key: 'cancelled',
      primary_guest_id: guestIds[4],
      room_type_id: roomTypeIds['Standard Single'],
      check_in: fmt(addDays(today, 10)),
      check_out: fmt(addDays(today, 12)),
      status: 'Cancelled',
      total_amount: 160.00,
      source: 'Direct',
    },
  ];

  const reservationIds: Record<string, string> = {};
  for (const rv of RESERVATIONS) {
    const { key, ...data } = rv;
    // Check by guest + check_in to avoid duplicates
    const existing = await knex('reservations')
      .where({ hotel_id: hotelId, primary_guest_id: data.primary_guest_id, check_in: data.check_in })
      .first();
    if (existing) {
      reservationIds[key] = existing.id;
    } else {
      const [row] = await knex('reservations')
        .insert({ ...data, hotel_id: hotelId, created_at: knex.fn.now(), updated_at: knex.fn.now() })
        .returning('id');
      reservationIds[key] = row.id ?? row;
    }
  }
  console.log('✅ Reservations seeded');

  // ── Mark room 102 as occupied for the checked-in reservation ─────────────
  if (roomIds['102']) {
    await knex('rooms').where({ id: roomIds['102'] }).update({ status: 'Occupied', updated_at: knex.fn.now() });
  }

  // ── 8. Check-in record for the 'checkedin' reservation ───────────────────
  const existingCheckIn = await knex('check_ins')
    .where({ hotel_id: hotelId, reservation_id: reservationIds['checkedin'] })
    .first();
  let checkInId: string | undefined;
  if (existingCheckIn) {
    checkInId = existingCheckIn.id;
  } else if (reservationIds['checkedin'] && roomIds['102']) {
    const [row] = await knex('check_ins')
      .insert({
        hotel_id: hotelId,
        reservation_id: reservationIds['checkedin'],
        actual_room_id: roomIds['102'],
        check_in_time: new Date(addDays(today, -1).setHours(15, 0, 0, 0)).toISOString(),
        expected_checkout_time: new Date(addDays(today, 2).setHours(11, 0, 0, 0)).toISOString(),
        status: 'checked_in',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .returning('id');
    checkInId = row.id ?? row;
  }
  console.log('✅ Check-in record seeded');

  // ── 9. Invoices ───────────────────────────────────────────────────────────
  const INVOICES = [
    {
      reservation_id: reservationIds['checkedout'],
      guest_id: guestIds[3],
      amount: 600.00,
      status: 'Paid',
      payment_method: 'Card',
      issue_date: fmt(addDays(today, -2)),
      due_date: fmt(addDays(today, 28)),
      notes: 'Auto-generated on checkout',
    },
    {
      reservation_id: reservationIds['checkedin'],
      guest_id: guestIds[2],
      amount: 160.00,
      status: 'Pending',
      payment_method: null,
      issue_date: fmt(today),
      due_date: fmt(addDays(today, 30)),
      notes: null,
    },
  ];
  const invoiceIds: string[] = [];
  for (const inv of INVOICES) {
    const existing = await knex('invoices')
      .where({ hotel_id: hotelId, reservation_id: inv.reservation_id })
      .first();
    if (existing) {
      invoiceIds.push(existing.id);
    } else {
      const [row] = await knex('invoices')
        .insert({ ...inv, hotel_id: hotelId, created_at: knex.fn.now(), updated_at: knex.fn.now() })
        .returning('id');
      invoiceIds.push(row.id ?? row);
    }
  }
  console.log('✅ Invoices seeded');

  // ── 10. Expenses ──────────────────────────────────────────────────────────
  const EXPENSES = [
    { description: 'Laundry supplies', amount: 150.00, category: 'Supplies', expense_date: fmt(addDays(today, -10)) },
    { description: 'Plumbing repair',  amount: 350.00, category: 'Maintenance', expense_date: fmt(addDays(today, -5)) },
    { description: 'Staff overtime',   amount: 200.00, category: 'Labor', expense_date: fmt(addDays(today, -3)) },
  ];
  for (const exp of EXPENSES) {
    const existing = await knex('expenses')
      .where({ hotel_id: hotelId, description: exp.description })
      .first();
    if (!existing) {
      await knex('expenses').insert({ ...exp, hotel_id: hotelId, created_at: knex.fn.now(), updated_at: knex.fn.now() });
    }
  }
  console.log('✅ Expenses seeded');

  // ── 11. Maintenance requests ──────────────────────────────────────────────
  const MAINTENANCE = [
    { title: 'Broken AC',      description: 'AC not cooling', room_id: roomIds['101'], priority: 'High',   status: 'Open' },
    { title: 'Leaking faucet', description: 'Dripping tap',   room_id: roomIds['201'], priority: 'Medium', status: 'In Progress' },
    { title: 'Window crack',   description: 'Small crack',    room_id: roomIds['301'], priority: 'Low',    status: 'Repaired' },
  ];
  for (const mr of MAINTENANCE) {
    const existing = await knex('maintenance_requests')
      .where({ hotel_id: hotelId, room_id: mr.room_id, title: mr.title })
      .first();
    if (!existing) {
      await knex('maintenance_requests').insert({
        ...mr,
        hotel_id: hotelId,
        reported_at: knex.fn.now(),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }
  console.log('✅ Maintenance requests seeded');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🧪 Test Data Summary:');
  console.log(`   Hotel (default): ${hotelId}`);
  console.log(`   Hotel B (tenancy): ${hotelBId}`);
  console.log('   Users: manager / frontdesk / housekeeping / maintenance / viewer @testhotel.com (pw: test1234)');
  console.log('   Rooms: 101, 102, 103, 201, 202, 301');
  console.log('   Reservations: confirmed-future, confirmed-today, checkedin, checkedout, cancelled');
  console.log(`   Check-in ID: ${checkInId}`);
}
