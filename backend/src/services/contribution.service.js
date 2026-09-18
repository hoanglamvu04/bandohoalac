import { pool } from '../database/pool.js';

const LIST_SELECT = `
  SELECT
    ct.id, ct.user_id, ct.place_id, ct.type, ct.status, ct.payload,
    ct.reject_reason, ct.reviewed_by, ct.reviewed_at, ct.created_at, ct.updated_at,
    u.name AS user_name, u.email AS user_email,
    p.name AS place_name
  FROM contributions ct
  JOIN users u ON u.id = ct.user_id
  LEFT JOIN places p ON p.id = ct.place_id
`;

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    placeId: row.place_id,
    placeName: row.place_name,
    type: row.type,
    status: row.status,
    payload: row.payload,
    rejectReason: row.reject_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createContribution({ userId, placeId, type, payload }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO contributions (user_id, place_id, type, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, placeId || null, type, JSON.stringify(payload || {})]
  );
  return rows[0].id;
}

export async function getContributionById(id, client = pool) {
  const { rows } = await client.query(`${LIST_SELECT} WHERE ct.id = $1`, [id]);
  return mapRow(rows[0]);
}

export async function getContributionForUpdate(id, client) {
  const { rows } = await client.query('SELECT * FROM contributions WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] || null;
}

export async function listContributionsByUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `${LIST_SELECT} WHERE ct.user_id = $1 ORDER BY ct.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows.map(mapRow);
}

export async function listContributions({ status, limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE ct.status = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `${LIST_SELECT} ${where} ORDER BY ct.created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows.map(mapRow);
}

export async function markContributionReviewed(id, { status, reviewedBy, rejectReason, placeId }, client) {
  await client.query(
    `UPDATE contributions
     SET status = $1, reviewed_by = $2, reviewed_at = NOW(), reject_reason = $3,
         place_id = COALESCE($4, place_id), updated_at = NOW()
     WHERE id = $5`,
    [status, reviewedBy, rejectReason || null, placeId || null, id]
  );
}

export async function recordChange(contributionId, field, oldValue, newValue, client) {
  await client.query(
    `INSERT INTO contribution_changes (contribution_id, field, old_value, new_value)
     VALUES ($1, $2, $3, $4)`,
    [contributionId, field, oldValue === undefined || oldValue === null ? null : String(oldValue),
      newValue === undefined || newValue === null ? null : String(newValue)]
  );
}
