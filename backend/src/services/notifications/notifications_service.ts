import db from '../../config/database.js';
import type { Knex } from 'knex';

export interface NotificationRow {
  id: string;
  hotel_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  dedupe_key: string | null;
  read_at: Date | null;
  created_at: Date;
}

export async function createNotificationDeduped(
  params: {
    hotelId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
  },
  trx?: Knex.Transaction,
): Promise<boolean> {
  const runner = trx ?? db;
  if (params.dedupeKey) {
    const existing = await runner('notifications')
      .where({
        hotel_id: params.hotelId,
        user_id: params.userId,
        dedupe_key: params.dedupeKey,
      })
      .first();
    if (existing) return false;
  }
  await runner('notifications').insert({
    hotel_id: params.hotelId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    payload: params.payload ?? null,
    dedupe_key: params.dedupeKey ?? null,
  });
  return true;
}

/** Users assigned to hotel with any of the given roles (active, not deleted). */
export async function getUserIdsForHotelRoles(
  hotelId: string,
  roles: string[],
  trx?: Knex.Transaction,
): Promise<string[]> {
  const runner = trx ?? db;
  const rows = await runner('user_hotels')
    .join('users', 'user_hotels.user_id', 'users.id')
    .where('user_hotels.hotel_id', hotelId)
    .whereIn('users.role', roles)
    .where('users.is_active', true)
    .whereNull('users.deleted_at')
    .distinct('users.id')
    .select('users.id');

  return rows.map((r: { id: string }) => r.id);
}

export async function notifyUsersForHotel(
  hotelId: string,
  userIds: string[],
  type: string,
  title: string,
  body: string,
  options?: { dedupeKeyPrefix?: string; payload?: Record<string, unknown> },
): Promise<void> {
  for (const userId of userIds) {
    const dedupe = options?.dedupeKeyPrefix ? `${options.dedupeKeyPrefix}:${userId}` : undefined;
    const params: Parameters<typeof createNotificationDeduped>[0] = {
      hotelId,
      userId,
      type,
      title,
      body,
    };
    if (options?.payload) params.payload = options.payload;
    if (dedupe) params.dedupeKey = dedupe;
    await createNotificationDeduped(params).catch((err) =>
      console.error('[notifications] insert failed:', err),
    );
  }
}

export async function listNotificationsForUser(
  hotelId: string,
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number; offset?: number },
): Promise<{ items: NotificationRow[]; total: number }> {
  let q = db('notifications')
    .where({ hotel_id: hotelId, user_id: userId })
    .orderBy('created_at', 'desc');

  if (opts.unreadOnly) {
    q = q.whereNull('read_at');
  }

  const countRow = await db('notifications')
    .where({ hotel_id: hotelId, user_id: userId })
    .modify((qb) => {
      if (opts.unreadOnly) qb.whereNull('read_at');
    })
    .count('* as count')
    .first();

  const total = Number(countRow?.count ?? 0);
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const items = await q.limit(limit).offset(offset);

  return { items: items as NotificationRow[], total };
}

export async function markNotificationRead(
  hotelId: string,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const updated = await db('notifications')
    .where({ id: notificationId, hotel_id: hotelId, user_id: userId })
    .whereNull('read_at')
    .update({ read_at: db.fn.now() });
  return updated > 0;
}

export async function markAllNotificationsRead(hotelId: string, userId: string): Promise<number> {
  return db('notifications')
    .where({ hotel_id: hotelId, user_id: userId })
    .whereNull('read_at')
    .update({ read_at: db.fn.now() });
}
