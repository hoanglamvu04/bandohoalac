import { pool } from '../database/pool.js';

export async function createNotification({
  userId,
  type,
  title,
  message,
  data = {}
}, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, type, title, message, data, read_at, created_at`,
    [userId, type, title, message, JSON.stringify(data || {})]
  );
  return mapNotification(rows[0]);
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data || {},
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

export async function listNotifications(userId, { limit = 30, unreadOnly = false } = {}) {
  const params = [userId];
  let unreadSql = '';

  if (unreadOnly) {
    unreadSql = ' AND read_at IS NULL';
  }

  params.push(Math.min(Number(limit) || 30, 100));

  const { rows } = await pool.query(
    `SELECT id, user_id, type, title, message, data, read_at, created_at
     FROM notifications
     WHERE user_id = $1${unreadSql}
     ORDER BY created_at DESC
     LIMIT $2`,
    params
  );

  return rows.map(mapNotification);
}

export async function countUnreadNotifications(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
  return rows[0]?.count || 0;
}

export async function markNotificationRead(id, userId) {
  const { rows } = await pool.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, type, title, message, data, read_at, created_at`,
    [id, userId]
  );
  return mapNotification(rows[0]);
}

export async function markAllNotificationsRead(userId) {
  await pool.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
}
