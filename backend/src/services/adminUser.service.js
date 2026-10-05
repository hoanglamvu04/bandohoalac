import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

function mapUser(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    accountStatus: row.account_status,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    points: Number(row.points_total || 0),
    pointsBalance: Number(row.points_balance || 0),
    trustScore: Number(row.trust_score || 0),
    approvedCount: Number(row.approved_count || 0),
    rejectedCount: Number(row.rejected_count || 0),
    contributionsCount: Number(row.contributions_count || 0),
    placesCount: Number(row.places_count || 0),
    photosCount: Number(row.photos_count || 0),
    partnerMembershipCount: Number(row.partner_membership_count || 0),
    ctvLevel: Number(row.ctv_level || 1),
    ctvTrustScore: Number(row.ctv_trust_score || 0),
    ctvReviewsCount: Number(row.ctv_reviews_count || 0),
    ctvConfirmedCount: Number(row.ctv_confirmed_count || 0),
    ctvOverturnedCount: Number(row.ctv_overturned_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const USER_SELECT = `
  SELECT
    u.*,
    (SELECT COUNT(*)::int FROM contributions c WHERE c.user_id = u.id) AS contributions_count,
    (SELECT COUNT(*)::int FROM places p WHERE p.created_by = u.id AND p.status = 'PUBLISHED') AS places_count,
    (SELECT COUNT(*)::int FROM place_images pi WHERE pi.uploaded_by = u.id) AS photos_count,
    (
      SELECT COUNT(*)::int
      FROM partner_memberships prm
      WHERE prm.user_id = u.id
        AND prm.status = 'ACTIVE'
    ) AS partner_membership_count
  FROM users u
`;

export async function listAdminUsers({ q, role = 'ALL', accountStatus = 'ALL', limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    params.push('%' + String(q).trim() + '%');
    const ref = '$' + params.length;
    conditions.push('(u.name ILIKE ' + ref + ' OR u.email ILIKE ' + ref + ')');
  }
  if (role && role !== 'ALL') {
    params.push(role);
    conditions.push('u.role = $' + params.length);
  }
  if (accountStatus && accountStatus !== 'ALL') {
    params.push(accountStatus);
    conditions.push('u.account_status = $' + params.length);
  }

  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
  const limitRef = '$' + params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetRef = '$' + params.length;

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await pool.query(
    USER_SELECT + where + ' ORDER BY u.created_at DESC LIMIT ' + limitRef + ' OFFSET ' + offsetRef,
    params
  );
  return rows.map(mapUser);
}

export async function listAdminUserPartnerMemberships(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT prm.id, prm.partner_id, prm.user_id, prm.role, prm.status,
            prm.created_at, prm.updated_at, pp.partner_name,
            pp.status AS partner_status, p.id AS place_id,
            p.name AS place_name, p.address AS place_address
     FROM partner_memberships prm
     JOIN place_partners pp ON pp.id = prm.partner_id
     JOIN places p ON p.id = pp.place_id
     WHERE prm.user_id = $1
     ORDER BY CASE prm.status WHEN 'ACTIVE' THEN 0 ELSE 1 END,
              CASE prm.role WHEN 'OWNER' THEN 0 ELSE 1 END,
              p.name ASC`,
    [userId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    partnerId: String(row.partner_id),
    userId: String(row.user_id),
    role: row.role,
    status: row.status,
    partnerName: row.partner_name || row.place_name,
    partnerStatus: row.partner_status,
    placeId: String(row.place_id),
    placeName: row.place_name,
    placeAddress: row.place_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getAdminUser(id, client = pool) {
  const { rows } = await client.query(USER_SELECT + ' WHERE u.id = $1', [id]);
  const item = mapUser(rows[0]);
  if (!item) return null;
  item.partnerMemberships = await listAdminUserPartnerMemberships(id, client);
  item.partnerMembershipCount = item.partnerMemberships.filter((membership) => membership.status === 'ACTIVE').length;
  return item;
}

export async function assignAdminUserPartnerAccess({ userId, partnerId, role, adminId }) {
  return withTransaction(async (client) => {
    const [userResult, partnerResult] = await Promise.all([
      client.query('SELECT id FROM users WHERE id = $1', [userId]),
      client.query('SELECT id FROM place_partners WHERE id = $1', [partnerId])
    ]);
    if (!userResult.rows[0]) throw new AppError('User not found.', 404);
    if (!partnerResult.rows[0]) throw new AppError('Partner not found.', 404);

    await client.query(
      `INSERT INTO partner_memberships (partner_id, user_id, role, status, created_by)
       VALUES ($1, $2, $3, 'ACTIVE', $4)
       ON CONFLICT (partner_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = NOW()`,
      [partnerId, userId, role, adminId]
    );
    return getAdminUser(userId, client);
  });
}

export async function updateAdminUserPartnerAccess({ userId, membershipId, role, status }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      'SELECT id, user_id FROM partner_memberships WHERE id = $1 FOR UPDATE',
      [membershipId]
    );
    if (!current.rows[0] || Number(current.rows[0].user_id) !== Number(userId)) {
      throw new AppError('Không tìm thấy quyền đối tác của người dùng này.', 404);
    }

    const params = [];
    const sets = [];
    if (role) { params.push(role); sets.push('role = $' + params.length); }
    if (status) { params.push(status); sets.push('status = $' + params.length); }
    if (!sets.length) return getAdminUser(userId, client);
    sets.push('updated_at = NOW()');
    params.push(membershipId);
    await client.query('UPDATE partner_memberships SET ' + sets.join(', ') + ' WHERE id = $' + params.length, params);
    return getAdminUser(userId, client);
  });
}

export async function updateAdminUser(id, values = {}) {
  const columnMap = {
    name: 'name',
    email: 'email',
    bio: 'bio',
    role: 'role',
    accountStatus: 'account_status',
    ctvLevel: 'ctv_level',
    ctvTrustScore: 'ctv_trust_score'
  };

  const params = [];
  const assignments = [];
  for (const [key, value] of Object.entries(values)) {
    const column = columnMap[key];
    if (!column) continue;
    params.push(value);
    assignments.push(column + ' = $' + params.length);
  }
  if (!assignments.length) return getAdminUser(id);
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING id`,
      params
    );
    if (!rows[0]) throw new AppError('User not found.', 404);
    return getAdminUser(id);
  } catch (error) {
    if (error?.code === '23505') throw new AppError('Email này đã được sử dụng bởi tài khoản khác.', 409);
    throw error;
  }
}

export async function adjustUserWallet({ userId, amount, reason, adminId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, points_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user = rows[0];
    if (!user) throw new AppError('User not found.', 404);
    const nextBalance = Number(user.points_balance || 0) + Number(amount);
    if (nextBalance < 0) throw new AppError('Không thể điều chỉnh khiến ví điểm âm.', 400);

    await client.query(
      'UPDATE users SET points_balance = $1, updated_at = NOW() WHERE id = $2',
      [nextBalance, userId]
    );
    await client.query(
      `INSERT INTO points_transactions (user_id, contribution_id, amount, reason)
       VALUES ($1, NULL, $2, $3)`,
      [userId, amount, 'ADMIN_WALLET_ADJUSTMENT:' + adminId + ':' + reason]
    );
    return getAdminUser(userId, client);
  });
}
