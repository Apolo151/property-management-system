import type { Knex } from 'knex';

/**
 * Data migration: Convert existing individual rooms to room types with quantity
 * 
 * Strategy:
 * 1. Group rooms by room_type, price_per_night, floor, and similar features
 * 2. Create room_types from grouped data
 * 3. Update reservations to reference room_types
 * 4. Preserve room_id in reservations for reference during transition
 */
export async function up(knex: Knex): Promise<void> {
  // Step 1: Group rooms by room_type, price_per_night (rounded to nearest 10), and floor
  // This creates room types from similar rooms
  // Use a simpler approach that works with Knex
  // Note: rooms table doesn't have deleted_at column, so we select all rooms
  const allRooms = await knex('rooms').select('*');

  if (allRooms.length === 0) {
    console.log('No rooms to migrate');
    return;
  }

  // Group rooms manually
  const roomGroupsMap = new Map<string, any[]>();

  for (const room of allRooms) {
    const roomType = room.room_type || 'double';
    const pricePerNight = parseFloat(room.price_per_night || '0');
    const priceGroup = Math.round(pricePerNight / 10) * 10;
    const floor = room.floor || 1;
    const key = `${roomType}_${priceGroup}_${floor}`;

    if (!roomGroupsMap.has(key)) {
      roomGroupsMap.set(key, []);
    }
    roomGroupsMap.get(key)!.push(room);
  }

  // Step 2: Create room_types from groups
  const roomTypeMap = new Map<string, string>(); // Maps (room_type, price_group, floor) -> room_type_id

  for (const [key, rooms] of roomGroupsMap) {
    if (rooms.length === 0) continue;

    const firstRoom = rooms[0];
    const roomType = firstRoom.room_type || 'double';
    const pricePerNight = parseFloat(firstRoom.price_per_night || '0');
    const floor = firstRoom.floor || 1;

    // Calculate aggregate values
    const qty = rooms.length;
    const avgPrice = rooms.reduce((sum, r) => sum + parseFloat(r.price_per_night || '0'), 0) / rooms.length;
    const maxPeople = Math.max(...rooms.map(r => parseInt(r.max_people || '0')).filter(v => v > 0), 0) || null;
    const maxAdult = Math.max(...rooms.map(r => parseInt(r.max_adult || '0')).filter(v => v > 0), 0) || null;
    const maxChildren = Math.max(...rooms.map(r => parseInt(r.max_children || '0')).filter(v => v > 0), 0) || null;
    const minStay = Math.min(...rooms.map(r => parseInt(r.min_stay || '999')).filter(v => v < 999), 999) || null;
    const maxStay = Math.max(...rooms.map(r => parseInt(r.max_stay || '0')).filter(v => v > 0), 0) || null;
    const roomSize = Math.max(...rooms.map(r => parseInt(r.room_size || '0')).filter(v => v > 0), 0) || null;

    // Aggregate features
    const allFeatures = new Set<string>();
    for (const room of rooms) {
      let features: string[] = [];
      try {
        if (Array.isArray(room.features)) {
          features = room.features;
        } else if (typeof room.features === 'string') {
          // Try to parse as JSON
          if (room.features.trim().startsWith('[') || room.features.trim().startsWith('{')) {
            features = JSON.parse(room.features);
          } else {
            // If it's not JSON, treat as empty array
            features = [];
          }
        }
      } catch (e) {
        // If parsing fails, use empty array
        features = [];
      }
      if (Array.isArray(features)) {
        features.forEach((f: string) => {
          if (f && typeof f === 'string') {
            allFeatures.add(f);
          }
        });
      }
    }

    // Generate room type name
    const roomNumbers = rooms.map(r => r.room_number).sort();
    const roomTypeName = roomNumbers.length === 1
      ? `${roomNumbers[0]} (${roomType})`
      : `${roomNumbers[0]}-${roomNumbers[roomNumbers.length - 1]} (${roomType})`;

    // Prepare features array - ensure it's a clean array
    const featuresArray = Array.from(allFeatures).filter(f => f && typeof f === 'string');
    
    // Prepare units - ensure it's valid
    let unitsValue: any[] = [];
    try {
      if (firstRoom.units !== null && firstRoom.units !== undefined) {
        if (typeof firstRoom.units === 'string') {
          // Try to parse JSON string
          if (firstRoom.units.trim()) {
            const parsed = JSON.parse(firstRoom.units);
            unitsValue = Array.isArray(parsed) ? parsed : [];
          }
        } else if (Array.isArray(firstRoom.units)) {
          unitsValue = firstRoom.units;
        } else if (typeof firstRoom.units === 'object' && firstRoom.units !== null) {
          unitsValue = [firstRoom.units];
        }
      }
    } catch (e) {
      // If parsing fails, use empty array
      console.warn(`Failed to parse units for room ${firstRoom.id}:`, e);
      unitsValue = [];
    }

    // Validate JSON before inserting
    let featuresJson: string;
    let unitsJson: string;
    try {
      featuresJson = JSON.stringify(featuresArray);
      unitsJson = JSON.stringify(unitsValue);
    } catch (e) {
      console.error('Failed to stringify JSON:', e);
      featuresJson = '[]';
      unitsJson = '[]';
    }

    // Create room type - use knex.raw for JSONB fields to ensure proper formatting
    try {
      const [roomTypeRecord] = await knex('room_types')
        .insert({
          name: roomTypeName,
          room_type: roomType,
          qty: qty,
          price_per_night: Math.round(avgPrice * 100) / 100,
          min_price: Math.round(avgPrice * 0.9 * 100) / 100,
          max_price: Math.round(avgPrice * 1.1 * 100) / 100,
          rack_rate: Math.round(avgPrice * 100) / 100,
          cleaning_fee: parseFloat(String(firstRoom.cleaning_fee || '0')),
          security_deposit: parseFloat(String(firstRoom.security_deposit || '0')),
          max_people: maxPeople,
          max_adult: maxAdult,
          max_children: maxChildren,
          min_stay: minStay === 999 ? null : minStay,
          max_stay: maxStay || null,
          room_size: roomSize,
          floor: floor,
          highlight_color: firstRoom.highlight_color || null,
          sell_priority: firstRoom.sell_priority ? parseInt(String(firstRoom.sell_priority)) : null,
          include_reports: firstRoom.include_reports !== undefined ? Boolean(firstRoom.include_reports) : true,
          restriction_strategy: firstRoom.restriction_strategy || null,
          overbooking_protection: firstRoom.overbooking_protection || null,
          block_after_checkout_days: parseInt(String(firstRoom.block_after_checkout_days || '0')),
          control_priority: firstRoom.control_priority ? parseInt(String(firstRoom.control_priority)) : null,
          unit_allocation: firstRoom.unit_allocation || 'perBooking',
          features: knex.raw('?::jsonb', [featuresJson]), // Use raw SQL for JSONB
          description: firstRoom.description || null,
          units: knex.raw('?::jsonb', [unitsJson]), // Use raw SQL for JSONB
          beds24_room_id: firstRoom.beds24_room_id ? String(firstRoom.beds24_room_id) : null,
        })
        .returning('id');

      // Store mapping for later use
      roomTypeMap.set(key, roomTypeRecord.id);
    } catch (error) {
      console.error(`Failed to create room type for key ${key}:`, error);
      console.error('Features JSON:', featuresJson);
      console.error('Units JSON:', unitsJson);
      console.error('First room data:', JSON.stringify(firstRoom, null, 2));
      throw error;
    }
  }

  // Step 3: Create mapping from individual rooms to room_types
  // We'll create a temporary mapping table
  await knex.schema.createTable('_room_to_room_type_mapping', (table) => {
    table.uuid('room_id').primary().references('id').inTable('rooms');
    table.uuid('room_type_id').notNullable().references('id').inTable('room_types');
  });

  // Populate mapping
  for (const room of allRooms) {
    const roomType = room.room_type || 'double';
    const pricePerNight = parseFloat(room.price_per_night || '0');
    const priceGroup = Math.round(pricePerNight / 10) * 10;
    const floor = room.floor || 1;
    const key = `${roomType}_${priceGroup}_${floor}`;
    
    const roomTypeId = roomTypeMap.get(key);
    if (roomTypeId) {
      await knex('_room_to_room_type_mapping').insert({
        room_id: room.id,
        room_type_id: roomTypeId,
      });
    }
  }

  // Step 4: Update reservations to use room_type_id
  const mappingRecords = await knex('_room_to_room_type_mapping').select('*');
  
  for (const mapping of mappingRecords) {
    await knex('reservations')
      .where({ room_id: mapping.room_id })
      .whereNull('deleted_at')
      .update({ room_type_id: mapping.room_type_id });
  }

  // Step 5: Set units_requested to 1 for all existing reservations
  await knex('reservations')
    .whereNull('units_requested')
    .update({ units_requested: 1 });

  // Step 6: Clean up temporary mapping table
  await knex.schema.dropTableIfExists('_room_to_room_type_mapping');
}

export async function down(knex: Knex): Promise<void> {
  // Reverse migration: This is complex and may not be fully reversible
  // We'll set room_type_id to NULL and try to restore room_id where possible
  
  // Clear room_type_id from reservations
  await knex('reservations').update({ room_type_id: null });
  
  // Note: We can't fully reverse the room_types creation without losing data
  // The rooms table still exists, so we can work with it
  // But we've lost the exact grouping that was used
}

