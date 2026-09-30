import { pool } from '../database/pool.js';

export async function writeAuditLog({
  actorUserId = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  client = pool
}) {
  if (!action || !entityType) return null;

  const { rows } = await client.query(
    `INSERT INTO audit_logs (
      actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id, created_at`,
    [
      actorUserId || null,
      action,
      entityType,
      entityId === null || entityId === undefined ? null : String(entityId),
      JSON.stringify(metadata || {}),
      ipAddress || null,
      userAgent || null
    ]
  );

  return rows[0] || null;
}

export function auditContextFromRequest(req) {
  return {
    ipAddress: req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.ip || null,
    userAgent: req.headers['user-agent'] || null
  };
}

export async function listAuditLogs({
  q,
  action,
  entityType,
  limit = 100,
  offset = 0
} = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    params.push('%' + String(q).trim() + '%');
    const ref = '$' + params.length;
    conditions.push(`(
      al.action ILIKE ${ref}
      OR al.entity_type ILIKE ${ref}
      OR COALESCE(al.entity_id, '') ILIKE ${ref}
      OR COALESCE(u.name, '') ILIKE ${ref}
      OR COALESCE(u.email, '') ILIKE ${ref}
    )`);
  }

  if (action && action !== 'ALL') {
    params.push(action);
    conditions.push('al.action = $' + params.length);
  }

  if (entityType && entityType !== 'ALL') {
    params.push(entityType);
    conditions.push('al.entity_type = $' + params.length);
  }

  params.push(Math.min(Math.max(Number(limit) || 100, 1), 300));
  const limitRef = '$' + params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetRef = '$' + params.length;

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await pool.query(
    `SELECT
       al.*,
       u.name AS actor_name,
       u.email AS actor_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT ${limitRef} OFFSET ${offsetRef}`,
    params
  );

  return rows.map((row) => ({
    id: String(row.id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorName: row.actor_name || null,
    actorEmail: row.actor_email || null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at
  }));
}
