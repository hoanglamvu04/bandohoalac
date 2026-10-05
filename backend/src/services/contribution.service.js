import { pool } from '../database/pool.js';

const LIST_SELECT = `
  SELECT
    ct.id, ct.user_id, ct.place_id, ct.type, ct.status, ct.payload,
    ct.reject_reason, ct.reviewed_by, ct.reviewed_at, ct.created_at, ct.updated_at,
    ct.risk_score, ct.risk_flags, ct.fingerprint,
    u.name AS user_name, u.email AS user_email,
    p.name AS place_name,
    rv.name AS reviewer_name, rv.role AS reviewer_role,
    rv.ctv_level AS reviewer_ctv_level, rv.ctv_trust_score AS reviewer_ctv_trust_score,
    cma.verdict AS ctv_audit_verdict, cma.note AS ctv_audit_note,
    (
      SELECT COUNT(*)::int
      FROM road_status_confirmations rc
      WHERE rc.contribution_id = ct.id AND rc.verdict = 'STILL_ACTIVE'
    ) AS active_confirmations,
    (
      SELECT COUNT(*)::int
      FROM road_status_confirmations rc
      WHERE rc.contribution_id = ct.id AND rc.verdict = 'RESOLVED'
    ) AS resolved_confirmations
  FROM contributions ct
  JOIN users u ON u.id = ct.user_id
  LEFT JOIN places p ON p.id = ct.place_id
  LEFT JOIN users rv ON rv.id = ct.reviewed_by
  LEFT JOIN ctv_moderation_audits cma ON cma.contribution_id = ct.id
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
    moderation: row.payload?.moderation || null,
    rejectReason: row.reject_reason,
    reviewedBy: row.reviewed_by,
    reviewerName: row.reviewer_name || null,
    reviewerRole: row.reviewer_role || null,
    reviewerCtvLevel: row.reviewer_ctv_level ? Number(row.reviewer_ctv_level) : null,
    reviewerCtvTrustScore: row.reviewer_ctv_trust_score !== null && row.reviewer_ctv_trust_score !== undefined
      ? Number(row.reviewer_ctv_trust_score)
      : null,
    ctvAuditVerdict: row.ctv_audit_verdict || null,
    ctvAuditNote: row.ctv_audit_note || null,
    riskScore: Number(row.risk_score || 0),
    riskFlags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeConfirmations: Number(row.active_confirmations || 0),
    resolvedConfirmations: Number(row.resolved_confirmations || 0)
  };
}

export async function createContribution({
  userId,
  placeId,
  type,
  payload,
  riskScore = 0,
  riskFlags = [],
  fingerprint = null
}, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO contributions (
       user_id, place_id, type, payload, risk_score, risk_flags, fingerprint
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [
      userId,
      placeId || null,
      type,
      JSON.stringify(payload || {}),
      Math.max(0, Math.min(100, Number(riskScore) || 0)),
      JSON.stringify(riskFlags || []),
      fingerprint || null
    ]
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
    `${LIST_SELECT} ${where} ORDER BY ct.risk_score DESC, ct.created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows.map(mapRow);
}

export async function markContributionReviewed(
  id,
  { status, reviewedBy, rejectReason, placeId, moderation },
  client
) {
  await client.query(
    `UPDATE contributions
     SET status = $1,
         reviewed_by = $2,
         reviewed_at = NOW(),
         reject_reason = $3,
         place_id = COALESCE($4, place_id),
         payload = CASE
           WHEN $5::jsonb IS NULL THEN payload
           ELSE jsonb_set(COALESCE(payload, '{}'::jsonb), '{moderation}', $5::jsonb, TRUE)
         END,
         updated_at = NOW()
     WHERE id = $6`,
    [
      status,
      reviewedBy,
      rejectReason || null,
      placeId || null,
      moderation ? JSON.stringify(moderation) : null,
      id
    ]
  );
}

export async function recordChange(contributionId, field, oldValue, newValue, client) {
  await client.query(
    `INSERT INTO contribution_changes (contribution_id, field, old_value, new_value)
     VALUES ($1, $2, $3, $4)`,
    [
      contributionId,
      field,
      oldValue === undefined || oldValue === null ? null : String(oldValue),
      newValue === undefined || newValue === null ? null : String(newValue)
    ]
  );
}
