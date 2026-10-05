import { getExplorerLevel } from './explorerLevel.service.js';
import { pool } from '../database/pool.js';

export async function findUserByEmail(email, client = pool) {
  const { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function findUserById(id, client = pool) {
  const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createUser({ name, email, passwordHash, role = 'USER' }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    points: Number(user.points_total || 0),
    pointsBalance: Number(user.points_balance || 0),
    explorerLevel: getExplorerLevel(user.points_total),
    trustScore: user.trust_score,
    approvedCount: user.approved_count,
    rejectedCount: user.rejected_count,
    ctvLevel: Number(user.ctv_level || 1),
    ctvTrustScore: Number(user.ctv_trust_score || 0),
    ctvReviewsCount: Number(user.ctv_reviews_count || 0),
    ctvConfirmedCount: Number(user.ctv_confirmed_count || 0),
    ctvOverturnedCount: Number(user.ctv_overturned_count || 0),
    createdAt: user.created_at
  };
}

export async function getUserBadges(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT b.code, b.name, b.description, b.icon, ub.awarded_at
     FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = $1
     ORDER BY ub.awarded_at DESC`,
    [userId]
  );
  return rows;
}

export async function getRecentActivity(userId, limit = 10, client = pool) {
  const { rows } = await client.query(
    `SELECT c.id, c.type, c.status, c.created_at,
            COALESCE((
              SELECT SUM(pt.amount)
              FROM points_transactions pt
              WHERE pt.contribution_id = c.id
            ), 0)::int AS points_awarded,
            p.name AS place_name
     FROM contributions c
     LEFT JOIN places p ON p.id = c.place_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getPartnerAccessSummary(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       prm.partner_id,
       prm.role,
       prm.status,
       COALESCE(pp.partner_name, p.name) AS partner_name,
       p.id AS place_id,
       p.name AS place_name
     FROM partner_memberships prm
     JOIN place_partners pp ON pp.id = prm.partner_id
     JOIN places p ON p.id = pp.place_id
     WHERE prm.user_id = $1
       AND prm.status = 'ACTIVE'
       AND pp.status = 'ACTIVE'
     ORDER BY
       CASE prm.role WHEN 'OWNER' THEN 0 ELSE 1 END,
       p.name ASC`,
    [userId]
  );

  return {
    hasAccess: rows.length > 0,
    memberships: rows.map((row) => ({
      partnerId: String(row.partner_id),
      role: row.role,
      status: row.status,
      partnerName: row.partner_name,
      placeId: String(row.place_id),
      placeName: row.place_name
    }))
  };
}
