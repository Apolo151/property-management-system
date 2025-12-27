import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms', (table) => {
    // Beds24 room identifier (maps PMS room to Beds24 room)
    table.string('beds24_room_id', 255);
  });

  // Index for Beds24 room lookups
  await knex.schema.raw(`
    CREATE INDEX idx_rooms_beds24_room_id ON rooms(beds24_room_id) WHERE beds24_room_id IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms', (table) => {
    table.dropColumn('beds24_room_id');
  });
}

