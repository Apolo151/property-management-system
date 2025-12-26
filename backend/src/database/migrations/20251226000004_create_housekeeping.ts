import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('housekeeping', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('room_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('rooms')
      .onDelete('CASCADE');
    table.string('status', 50).notNullable().defaultTo('Clean');
    table.uuid('assigned_staff_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('assigned_staff_name', 255); // For staff names when not linked to user account
    table.timestamp('last_cleaned', { useTz: true });
    table.text('notes');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Check constraint using raw SQL
  await knex.schema.raw(`
    ALTER TABLE housekeeping 
    ADD CONSTRAINT check_housekeeping_status 
    CHECK (status IN ('Clean', 'Dirty', 'In Progress'));
  `);

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_housekeeping_room_id ON housekeeping(room_id);
    CREATE INDEX idx_housekeeping_status ON housekeeping(status);
    CREATE INDEX idx_housekeeping_assigned_staff_id ON housekeeping(assigned_staff_id);
    CREATE INDEX idx_housekeeping_last_cleaned ON housekeeping(last_cleaned);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('housekeeping');
}

