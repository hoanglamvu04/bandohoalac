import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

function mapClaim(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    placeName: row.place_name,
    placeAddress: row.place_address,
    placeImage: row.place_image || null,
    userId: String(row.user_id),
    userName: row.user_name,
    userEmail: row.user_email,
    businessName: row.business_name,
    contactPhone: row.contact_phone,
    proofNote: row.proof_note,
    status: row.status,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const CLAIM_SELECT = `
  SELECT
    pc.*,
    p.name AS place_name,
    p.address AS place_address,
    u.name AS user_name,
    u.email AS user_email,
    (
      SELECT pi.url
      FROM place_images pi
      WHERE pi.place_id = p.id
      ORDER BY pi.is_cover DESC, pi.id ASC
      LIMIT 1
    ) AS place_image
  FROM place_claims pc
  JOIN places p ON p.id = pc.place_id
  JOIN users u ON u.id = pc.user_id
`;

export async function createPlaceClaim({ placeId, userId, businessName, contactPhone, proofNote }) {
  const managerCheck = await pool.query(
    'SELECT 1 FROM place_managers WHERE place_id = $1 AND user_id = $2 LIMIT 1',
    [placeId, userId]
  );
  if (managerCheck.rows[0]) {
    throw new AppError('Bạn đã được xác minh là người quản lý địa điểm này.', 409);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO place_claims (
         place_id, user_id, business_name, contact_phone, proof_note
       )
       SELECT p.id, $2, $3, $4, $5
       FROM places p
       WHERE p.id = $1 AND p.status = 'PUBLISHED'
       RETURNING id`,
      [placeId, userId, businessName || null, contactPhone, proofNote]
    );
    if (!rows[0]) throw new AppError('Địa điểm không tồn tại hoặc chưa được xuất bản.', 404);
    return getPlaceClaim(rows[0].id);
  } catch (error) {
    if (error?.code === '23505') {
      throw new AppError('Bạn đã gửi yêu cầu xác minh cho địa điểm này và đang chờ duyệt.', 409);
    }
    throw error;
  }
}

export async function getPlaceClaim(id, client = pool) {
  const { rows } = await client.query(CLAIM_SELECT + ' WHERE pc.id = $1', [id]);
  return mapClaim(rows[0]);
}

export async function listMyPlaceClaims(userId) {
  const { rows } = await pool.query(
    CLAIM_SELECT + ' WHERE pc.user_id = $1 ORDER BY pc.created_at DESC',
    [userId]
  );
  return rows.map(mapClaim);
}

export async function listPlaceClaimsAdmin({ status = 'ALL' } = {}) {
  const params = [];
  let where = '';
  if (status && status !== 'ALL') {
    params.push(status);
    where = ' WHERE pc.status = $1';
  }
  const { rows } = await pool.query(
    CLAIM_SELECT + where + " ORDER BY CASE pc.status WHEN 'PENDING' THEN 0 ELSE 1 END, pc.created_at DESC",
    params
  );
  return rows.map(mapClaim);
}

export async function reviewPlaceClaim({ claimId, status, reviewNote, reviewedBy }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM place_claims WHERE id = $1 FOR UPDATE',
      [claimId]
    );
    const claim = rows[0];
    if (!claim) throw new AppError('Yêu cầu xác minh không tồn tại.', 404);
    if (claim.status !== 'PENDING') throw new AppError('Yêu cầu này đã được xử lý.', 409);

    await client.query(
      `UPDATE place_claims
       SET status = $1,
           review_note = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [status, reviewNote || null, reviewedBy, claimId]
    );

    if (status === 'APPROVED') {
      await client.query(
        `INSERT INTO place_managers (place_id, user_id, role, created_by)
         VALUES ($1,$2,'OWNER',$3)
         ON CONFLICT (place_id, user_id)
         DO UPDATE SET role = 'OWNER'`,
        [claim.place_id, claim.user_id, reviewedBy]
      );

      await client.query(
        `INSERT INTO partner_memberships (partner_id, user_id, role, status, created_by)
         SELECT pp.id, $2, 'OWNER', 'ACTIVE', $3
         FROM place_partners pp
         WHERE pp.place_id = $1
         ON CONFLICT (partner_id, user_id)
         DO UPDATE SET role = 'OWNER', status = 'ACTIVE', updated_at = NOW()`,
        [claim.place_id, claim.user_id, reviewedBy]
      );
    }

    return getPlaceClaim(claimId, client);
  });
}
