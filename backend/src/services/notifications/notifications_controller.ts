import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/auth_middleware.js';
import {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications_service.js';

export async function getNotificationsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const hotelId = req.hotelId!;
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread_only === 'true' || req.query.unread_only === '1';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const listOpts: { unreadOnly?: boolean; limit?: number; offset?: number } = { unreadOnly };
    if (limit !== undefined) listOpts.limit = limit;
    if (offset !== undefined) listOpts.offset = offset;
    const { items, total } = await listNotificationsForUser(hotelId, userId, listOpts);

    res.json({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
        read: n.read_at != null,
        read_at: n.read_at,
        created_at: n.created_at,
      })),
      total,
    });
  } catch (e) {
    next(e);
  }
}

export async function markNotificationReadHandler(
  req: AuthenticatedRequest<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const hotelId = req.hotelId!;
    const userId = req.user!.userId;
    const ok = await markNotificationRead(hotelId, userId, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function markAllNotificationsReadHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const hotelId = req.hotelId!;
    const userId = req.user!.userId;
    const n = await markAllNotificationsRead(hotelId, userId);
    res.json({ success: true, marked: n });
  } catch (e) {
    next(e);
  }
}
