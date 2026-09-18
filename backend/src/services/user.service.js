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
    points: user.points_total,
    trustScore: user.trust_score,
    approvedCount: user.approved_count,
    rejectedCount: user.rejected_count,
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
            pt.amount AS points_awarded,
            p.name AS place_name
     FROM contributions c
     LEFT JOIN points_transactions pt ON pt.contribution_id = c.id
     LEFT JOIN places p ON p.id = c.place_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}
