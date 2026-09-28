import { asyncHandler } from '../utils/asyncHandler.js';
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../services/notification.service.js';

export const listMine = asyncHandler(async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    listNotifications(req.user.id, {
      limit: req.query.limit,
      unreadOnly: req.query.unread === '1'
    }),
    countUnreadNotifications(req.user.id)
  ]);

  res.json({ items, unreadCount });
});

export const markRead = asyncHandler(async (req, res) => {
  const item = await markNotificationRead(Number(req.params.id), req.user.id);
  res.json({ item });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await markAllNotificationsRead(req.user.id);
  res.json({ ok: true });
});
