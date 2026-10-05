import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

export async function capturePlaceSnapshot(placeId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       p.id, p.name, p.description, p.category_id, c.slug AS category_slug,
       p.address, p.phone, p.website, p.price_level, p.opening_hours,
       p.status, p.source, p.last_verified_at,
       ST_Y(p.location::geometry) AS lat,
       ST_X(p.location::geometry) AS lng,
       p.updated_at,
       (SELECT COUNT(*)::int FROM place_images pi WHERE pi.place_id = p.id) AS image_count,
       (SELECT MAX(pi.created_at) FROM place_images pi WHERE pi.place_id = p.id) AS latest_image_at
     FROM places p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [placeId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    address: row.address,
    phone: row.phone,
    website: row.website,
    priceLevel: row.price_level,
    openingHours: row.opening_hours,
    status: row.status,
    source: row.source,
    lastVerifiedAt: row.last_verified_at,
    lat: Number(row.lat),
    lng: Number(row.lng),
    imageCount: Number(row.image_count || 0),
    latestImageAt: row.latest_image_at,
    updatedAt: row.updated_at
  };
}

export async function recordPlaceRevision({
  placeId,
  action,
  beforeSnapshot,
  afterSnapshot,
  actorUserId,
  contributionId = null,
  reason = null,
  rolledBackFromRevisionId = null
}, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO place_revisions (
       place_id, action, before_snapshot, after_snapshot, actor_user_id,
       contribution_id, reason, rolled_back_from_revision_id
     ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8)
     RETURNING id, created_at`,
    [
      placeId,
      action,
      beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
      afterSnapshot ? JSON.stringify(afterSnapshot) : null,
      actorUserId || null,
      contributionId || null,
      reason || null,
      rolledBackFromRevisionId || null
    ]
  );
  return { id: String(rows[0].id), createdAt: rows[0].created_at };
}

export async function listPlaceRevisions(placeId, { limit = 50 } = {}, client = pool) {
  const { rows } = await client.query(
    `SELECT
       r.id, r.place_id, r.action, r.before_snapshot, r.after_snapshot,
       r.actor_user_id, r.contribution_id, r.reason,
       r.rolled_back_from_revision_id, r.created_at,
       u.name AS actor_name, u.role AS actor_role
     FROM place_revisions r
     LEFT JOIN users u ON u.id = r.actor_user_id
     WHERE r.place_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [placeId, Math.min(Math.max(Number(limit) || 50, 1), 100)]
  );
  return rows.map((row) => ({
    id: String(row.id),
    placeId: String(row.place_id),
    action: row.action,
    before: row.before_snapshot,
    after: row.after_snapshot,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorName: row.actor_name || 'Hệ thống',
    actorRole: row.actor_role || null,
    contributionId: row.contribution_id ? String(row.contribution_id) : null,
    reason: row.reason,
    rolledBackFromRevisionId: row.rolled_back_from_revision_id ? String(row.rolled_back_from_revision_id) : null,
    createdAt: row.created_at,
    rollbackSupported: Boolean(row.before_snapshot) && !['IMAGE_ADD', 'IMAGE_DELETE', 'IMAGE_COVER'].includes(row.action)
  }));
}

async function applySnapshot(placeId, snapshot, client) {
  if (!snapshot) throw new AppError('Revision has no previous state to restore.', 400);
  await client.query(
    `UPDATE places
     SET name = $2,
         description = $3,
         category_id = $4,
         address = $5,
         phone = $6,
         website = $7,
         price_level = $8,
         opening_hours = $9,
         status = $10,
         last_verified_at = $11,
         location = ST_SetSRID(ST_MakePoint($12, $13), 4326),
         updated_at = NOW()
     WHERE id = $1`,
    [
      placeId,
      snapshot.name,
      snapshot.description || null,
      snapshot.categoryId || null,
      snapshot.address || null,
      snapshot.phone || null,
      snapshot.website || null,
      snapshot.priceLevel || null,
      snapshot.openingHours || null,
      snapshot.status || 'PUBLISHED',
      snapshot.lastVerifiedAt || null,
      Number(snapshot.lng),
      Number(snapshot.lat)
    ]
  );
}

export async function rollbackPlaceRevision({ placeId, revisionId, actorUserId, reason }) {
  return withTransaction(async (client) => {
    const revisionResult = await client.query(
      `SELECT * FROM place_revisions
       WHERE id = $1 AND place_id = $2
       FOR UPDATE`,
      [revisionId, placeId]
    );
    const revision = revisionResult.rows[0];
    if (!revision) throw new AppError('Place revision not found.', 404);
    if (!revision.before_snapshot) throw new AppError('Revision has no previous state to restore.', 400);
    if (['IMAGE_ADD', 'IMAGE_DELETE', 'IMAGE_COVER'].includes(revision.action)) {
      throw new AppError('Rollback ảnh không được hỗ trợ vì file gốc có thể đã bị xóa.', 400);
    }

    const beforeRollback = await capturePlaceSnapshot(placeId, client);
    await applySnapshot(placeId, revision.before_snapshot, client);
    const afterRollback = await capturePlaceSnapshot(placeId, client);

    const rollback = await recordPlaceRevision({
      placeId,
      action: 'ROLLBACK',
      beforeSnapshot: beforeRollback,
      afterSnapshot: afterRollback,
      actorUserId,
      reason: reason || 'Hoàn tác revision #' + revisionId,
      rolledBackFromRevisionId: revisionId
    }, client);

    return { revision: rollback, place: afterRollback };
  });
}
