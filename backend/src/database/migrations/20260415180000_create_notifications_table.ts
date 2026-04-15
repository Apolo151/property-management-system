import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('hotel_id')
      .notNullable()
      .references('id')
      .inTable('hotels')
      .onDelete('CASCADE');
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('type', 80).notNullable();
    table.string('title', 255).notNullable();
    table.text('body');
    table.jsonb('payload');
    table.string('dedupe_key', 255).nullable();
    table.timestamp('read_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw(`
    CREATE INDEX idx_notifications_user_hotel ON notifications (user_id, hotel_id);
    CREATE INDEX idx_notifications_created ON notifications (hotel_id, created_at DESC);
    CREATE UNIQUE INDEX idx_notifications_dedupe
      ON notifications (hotel_id, user_id, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
