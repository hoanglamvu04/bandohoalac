import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { getRedemptionById } from './reward.service.js';

function normalizeStatus(status) {
  return status === 'REDEEMED' ? 'USED' : status;
}

function parseVoucherInput(value, explicitToken = null) {
  const raw = String(value || '').trim();
  let code = raw;
  let qrToken = explicitToken ? String(explicitToken).trim() : '';

  if (raw.toUpperCase().startsWith('HOLA-VOUCHER:')) {
    const parts = raw.split(':');
    code = String(parts[1] || '').trim();
    if (!qrToken && parts[2]) qrToken = String(parts[2]).trim();
  }

  return {
    code: code.toUpperCase(),
    qrToken
  };
}

async function ownerAccessForPartner(userId, partnerId, client = pool) {
  const { rows } = await client.query(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM partner_memberships prm
         WHERE prm.partner_id = $1
           AND prm.user_id = $2
           AND prm.status = 'ACTIVE'
           AND prm.role = 'OWNER'
       )
       OR EXISTS (
         SELECT 1
         FROM place_managers pm
         JOIN place_partners pp ON pp.place_id = pm.place_id
         WHERE pp.id = $1
           AND pm.user_id = $2
           AND pm.role = 'OWNER'
       )
     ) AS allowed`,
    [partnerId, userId]
  );

  return Boolean(rows[0]?.allowed);
}

async function accessForPartner(userId, partnerId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       pp.id AS partner_id,
       pp.place_id,
       pp.status AS partner_status,
       COALESCE(
         (
           SELECT prm.role
           FROM partner_memberships prm
           WHERE prm.partner_id = pp.id
             AND prm.user_id = $2
             AND prm.status = 'ACTIVE'
           LIMIT 1
         ),
         (
           SELECT CASE WHEN pm.role = 'OWNER' THEN 'OWNER' ELSE 'STAFF' END
           FROM place_managers pm
           WHERE pm.place_id = pp.place_id
             AND pm.user_id = $2
           LIMIT 1
         )
       ) AS role
     FROM place_partners pp
     WHERE pp.id = $1
       AND (
         EXISTS (
           SELECT 1
           FROM partner_memberships prm
           WHERE prm.partner_id = pp.id
             AND prm.user_id = $2
             AND prm.status = 'ACTIVE'
         )
         OR EXISTS (
           SELECT 1
           FROM place_managers pm
           WHERE pm.place_id = pp.place_id
             AND pm.user_id = $2
         )
       )
     LIMIT 1`,
    [partnerId, userId]
  );

  return rows[0] || null;
}

export async function listManagedPlaces(userId, client = pool) {
  const { rows } = await client.query(
    `WITH access_rows AS (
       SELECT
         p.id AS place_id,
         pm.role AS manager_role,
         p.name,
         p.address,
         p.phone,
         p.website,
         p.opening_hours,
         p.description,
         pp.id AS partner_id,
         pp.partner_name,
         pp.status AS partner_status,
         COALESCE(
           prm.role,
           CASE WHEN pm.role = 'OWNER' THEN 'OWNER' ELSE 'STAFF' END
         ) AS partner_role,
         TRUE AS can_edit_place,
         (pm.role = 'OWNER' OR prm.role = 'OWNER') AS can_manage_staff,
         (
           SELECT pi.url
           FROM place_images pi
           WHERE pi.place_id = p.id
           ORDER BY pi.is_cover DESC, pi.id ASC
           LIMIT 1
         ) AS image
       FROM place_managers pm
       JOIN places p ON p.id = pm.place_id
       LEFT JOIN place_partners pp ON pp.place_id = p.id
       LEFT JOIN partner_memberships prm
         ON prm.partner_id = pp.id
        AND prm.user_id = pm.user_id
        AND prm.status = 'ACTIVE'
       WHERE pm.user_id = $1

       UNION ALL

       SELECT
         p.id AS place_id,
         NULL::TEXT AS manager_role,
         p.name,
         p.address,
         p.phone,
         p.website,
         p.opening_hours,
         p.description,
         pp.id AS partner_id,
         pp.partner_name,
         pp.status AS partner_status,
         prm.role AS partner_role,
         FALSE AS can_edit_place,
         (prm.role = 'OWNER') AS can_manage_staff,
         (
           SELECT pi.url
           FROM place_images pi
           WHERE pi.place_id = p.id
           ORDER BY pi.is_cover DESC, pi.id ASC
           LIMIT 1
         ) AS image
       FROM partner_memberships prm
       JOIN place_partners pp ON pp.id = prm.partner_id
       JOIN places p ON p.id = pp.place_id
       WHERE prm.user_id = $1
         AND prm.status = 'ACTIVE'
         AND NOT EXISTS (
           SELECT 1
           FROM place_managers pm
           WHERE pm.place_id = pp.place_id
             AND pm.user_id = $1
         )
     )
     SELECT *
     FROM access_rows
     ORDER BY name ASC`,
    [userId]
  );

  return rows.map((row) => ({
    placeId: String(row.place_id),
    name: row.name,
    address: row.address,
    phone: row.phone,
    website: row.website,
    openingHours: row.opening_hours,
    description: row.description,
    image: row.image || null,
    managerRole: row.manager_role || null,
    partnerId: row.partner_id ? String(row.partner_id) : null,
    partnerName: row.partner_name || null,
    partnerStatus: row.partner_status || null,
    partnerRole: row.partner_role || null,
    canEditPlace: Boolean(row.can_edit_place),
    canManageStaff: Boolean(row.can_manage_staff)
  }));
}

async function listOwnerStaff(userId, partnerIds, client = pool) {
  if (!partnerIds.length) return [];

  const { rows } = await client.query(
    `SELECT
       prm.id,
       prm.partner_id,
       prm.user_id,
       prm.role,
       prm.status,
       prm.created_at,
       prm.updated_at,
       u.name AS user_name,
       u.email AS user_email,
       pp.partner_name,
       p.name AS place_name
     FROM partner_memberships prm
     JOIN users u ON u.id = prm.user_id
     JOIN place_partners pp ON pp.id = prm.partner_id
     JOIN places p ON p.id = pp.place_id
     WHERE prm.partner_id = ANY($1::bigint[])
     ORDER BY
       prm.partner_id ASC,
       CASE prm.role WHEN 'OWNER' THEN 0 ELSE 1 END,
       u.name ASC`,
    [partnerIds]
  );

  return rows.map((row) => ({
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: row.partner_name || row.place_name,
    placeName: row.place_name,
    userId: String(row.user_id),
    userName: row.user_name,
    userEmail: row.user_email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getPartnerDashboard(userId) {
  const managedPlaces = await listManagedPlaces(userId);
  const partnerIds = [
    ...new Set(
      managedPlaces
        .map((item) => Number(item.partnerId))
        .filter(Number.isFinite)
    )
  ];
  const ownerPartnerIds = [
    ...new Set(
      managedPlaces
        .filter((item) => item.canManageStaff && item.partnerId)
        .map((item) => Number(item.partnerId))
        .filter(Number.isFinite)
    )
  ];

  if (!partnerIds.length) {
    return {
      hasAccess: managedPlaces.length > 0,
      managedPlaces,
      campaigns: [],
      recentRedemptions: [],
      usageHistory: [],
      staffMembers: [],
      ownerPartnerIds: [],
      stats: {
        managedPlaces: managedPlaces.length,
        campaigns: 0,
        vouchersIssued: 0,
        vouchersPending: 0,
        vouchersUsed: 0,
        vouchersRedeemed: 0
      }
    };
  }

  const [campaignResult, redemptionResult, statsResult, staffMembers] = await Promise.all([
    pool.query(
      `SELECT
         vc.id,
         vc.title,
         vc.voucher_value_text,
         vc.status,
         vc.points_cost,
         vc.quantity_total,
         vc.quantity_redeemed,
         vc.starts_at,
         vc.ends_at,
         pp.id AS partner_id,
         COALESCE(pp.partner_name, p.name) AS partner_name,
         p.name AS place_name
       FROM voucher_campaigns vc
       JOIN place_partners pp ON pp.id = vc.partner_id
       JOIN places p ON p.id = pp.place_id
       WHERE vc.partner_id = ANY($1::bigint[])
       ORDER BY vc.updated_at DESC`,
      [partnerIds]
    ),
    pool.query(
      `SELECT
         vr.id,
         vr.code,
         vr.status,
         vr.points_spent,
         vr.created_at,
         vr.redeemed_at,
         vr.used_at,
         vr.expires_at,
         vr.used_by_user_id,
         vc.id AS campaign_id,
         vc.title AS campaign_title,
         vc.voucher_value_text,
         vc.terms,
         COALESCE(pp.partner_name, p.name) AS partner_name,
         pp.id AS partner_id,
         p.name AS place_name,
         u.name AS user_name,
         used_user.name AS used_by_name
       FROM voucher_redemptions vr
       JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
       JOIN place_partners pp ON pp.id = vc.partner_id
       JOIN places p ON p.id = pp.place_id
       JOIN users u ON u.id = vr.user_id
       LEFT JOIN users used_user ON used_user.id = vr.used_by_user_id
       WHERE vc.partner_id = ANY($1::bigint[])
       ORDER BY COALESCE(vr.used_at, vr.redeemed_at, vr.created_at) DESC
       LIMIT 120`,
      [partnerIds]
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE vr.status = 'ISSUED')::int AS pending,
         COUNT(*) FILTER (WHERE vr.status IN ('USED', 'REDEEMED'))::int AS used
       FROM voucher_redemptions vr
       JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
       WHERE vc.partner_id = ANY($1::bigint[])`,
      [partnerIds]
    ),
    listOwnerStaff(userId, ownerPartnerIds)
  ]);

  const campaigns = campaignResult.rows.map((row) => ({
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: row.partner_name,
    placeName: row.place_name,
    title: row.title,
    voucherValueText: row.voucher_value_text || null,
    status: row.status,
    pointsCost: Number(row.points_cost || 0),
    quantityTotal: row.quantity_total === null ? null : Number(row.quantity_total),
    quantityRedeemed: Number(row.quantity_redeemed || 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at
  }));

  const recentRedemptions = redemptionResult.rows.map((row) => ({
    id: String(row.id),
    code: row.code,
    status: normalizeStatus(row.status),
    pointsSpent: Number(row.points_spent || 0),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at || row.redeemed_at || null,
    redeemedAt: row.used_at || row.redeemed_at || null,
    usedByUserId: row.used_by_user_id ? String(row.used_by_user_id) : null,
    usedByName: row.used_by_name || null,
    campaignId: String(row.campaign_id),
    campaignTitle: row.campaign_title,
    voucherValueText: row.voucher_value_text || null,
    terms: row.terms || null,
    partnerId: String(row.partner_id),
    partnerName: row.partner_name,
    placeName: row.place_name,
    userName: row.user_name
  }));

  const usageHistory = recentRedemptions.filter((item) => item.status === 'USED');
  const rawStats = statsResult.rows[0] || {};

  return {
    hasAccess: managedPlaces.length > 0,
    managedPlaces,
    campaigns,
    recentRedemptions,
    usageHistory,
    staffMembers,
    ownerPartnerIds: ownerPartnerIds.map(String),
    stats: {
      managedPlaces: managedPlaces.length,
      campaigns: campaigns.length,
      vouchersIssued: Number(rawStats.total || 0),
      vouchersPending: Number(rawStats.pending || 0),
      vouchersUsed: Number(rawStats.used || 0),
      vouchersRedeemed: Number(rawStats.used || 0)
    }
  };
}

async function selectVoucherForPartner(client, { code, id, lock = false }) {
  const conditions = [];
  const params = [];

  if (id) {
    params.push(Number(id));
    conditions.push('vr.id = $' + params.length);
  } else {
    params.push(String(code || '').trim().toUpperCase());
    conditions.push('UPPER(vr.code) = $' + params.length);
  }

  const { rows } = await client.query(
    `SELECT
       vr.id,
       vr.campaign_id,
       vr.user_id,
       vr.code,
       vr.qr_token,
       vr.status,
       vr.points_spent,
       vr.created_at,
       vr.expires_at,
       vr.used_at,
       vr.redeemed_at,
       vr.used_by_user_id,
       vc.title AS campaign_title,
       vc.voucher_value_text,
       vc.terms,
       vc.ends_at AS campaign_ends_at,
       pp.id AS partner_id,
       pp.place_id,
       pp.partner_name,
       pp.status AS partner_status,
       p.name AS place_name,
       p.address AS place_address,
       u.name AS user_name,
       u.email AS user_email,
       used_user.name AS used_by_name
     FROM voucher_redemptions vr
     JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
     JOIN place_partners pp ON pp.id = vc.partner_id
     JOIN places p ON p.id = pp.place_id
     JOIN users u ON u.id = vr.user_id
     LEFT JOIN users used_user ON used_user.id = vr.used_by_user_id
     WHERE ${conditions.join(' AND ')}
     ${lock ? 'FOR UPDATE' : ''}`,
    params
  );

  return rows[0] || null;
}

function voucherInspectionPayload(row, valid, message) {
  return {
    id: String(row.id),
    code: row.code,
    status: normalizeStatus(row.status),
    valid,
    message,
    campaignId: String(row.campaign_id),
    campaignTitle: row.campaign_title,
    voucherValueText: row.voucher_value_text || null,
    terms: row.terms || null,
    partnerId: String(row.partner_id),
    partnerName: row.partner_name || row.place_name,
    placeId: String(row.place_id),
    placeName: row.place_name,
    placeAddress: row.place_address,
    userId: String(row.user_id),
    userName: row.user_name,
    pointsSpent: Number(row.points_spent || 0),
    createdAt: row.created_at,
    expiresAt: row.expires_at || row.campaign_ends_at || null,
    usedAt: row.used_at || row.redeemed_at || null,
    usedByName: row.used_by_name || null
  };
}

async function markExpiredIfNeeded(client, row) {
  const expiresAt = row.expires_at || row.campaign_ends_at;
  if (
    row.status === 'ISSUED' &&
    expiresAt &&
    new Date(expiresAt).getTime() < Date.now()
  ) {
    await client.query(
      `UPDATE voucher_redemptions
       SET status = 'EXPIRED'
       WHERE id = $1
         AND status = 'ISSUED'`,
      [row.id]
    );

    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, partner_id, metadata
       )
       VALUES ($1, 'EXPIRED', $2, $3::jsonb)`,
      [
        row.id,
        row.partner_id,
        JSON.stringify({ expiresAt })
      ]
    );

    row.status = 'EXPIRED';
  }
}

export async function inspectPartnerVoucher({
  userId,
  code,
  qrToken = null
}) {
  return withTransaction(async (client) => {
    const parsed = parseVoucherInput(code, qrToken);
    if (!parsed.code) throw new AppError('Nhập hoặc quét mã voucher.', 400);

    const row = await selectVoucherForPartner(client, {
      code: parsed.code,
      lock: true
    });

    if (!row) throw new AppError('Không tìm thấy mã voucher.', 404);

    const access = await accessForPartner(userId, row.partner_id, client);
    if (!access) {
      throw new AppError('Voucher này không thuộc địa điểm bạn được phép xác nhận.', 403);
    }

    if (parsed.qrToken && parsed.qrToken !== row.qr_token) {
      throw new AppError('QR voucher không hợp lệ hoặc đã bị thay đổi.', 409);
    }

    await markExpiredIfNeeded(client, row);

    const status = normalizeStatus(row.status);
    let valid = status === 'ISSUED' && row.partner_status === 'ACTIVE';
    let message = 'Voucher hợp lệ. Kiểm tra ưu đãi rồi xác nhận sử dụng.';

    if (row.partner_status !== 'ACTIVE') {
      valid = false;
      message = 'Đối tác hiện không ở trạng thái hoạt động.';
    } else if (status === 'USED') {
      valid = false;
      message = 'Voucher này đã được sử dụng.';
    } else if (status === 'EXPIRED') {
      valid = false;
      message = 'Voucher này đã hết hạn.';
    } else if (status === 'CANCELLED') {
      valid = false;
      message = 'Voucher này đã bị hủy.';
    } else if (status !== 'ISSUED') {
      valid = false;
      message = 'Voucher hiện không thể sử dụng.';
    }

    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, actor_user_id, partner_id, metadata
       )
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        row.id,
        parsed.qrToken ? 'SCANNED' : 'LOOKUP',
        userId,
        row.partner_id,
        JSON.stringify({
          valid,
          status,
          role: access.role || null
        })
      ]
    );

    return voucherInspectionPayload(row, valid, message);
  });
}

export async function usePartnerVoucher({
  userId,
  redemptionId = null,
  code = null,
  qrToken = null
}) {
  return withTransaction(async (client) => {
    const parsed = parseVoucherInput(code, qrToken);
    const row = await selectVoucherForPartner(client, {
      id: redemptionId,
      code: parsed.code,
      lock: true
    });

    if (!row) throw new AppError('Không tìm thấy voucher.', 404);

    const access = await accessForPartner(userId, row.partner_id, client);
    if (!access) {
      throw new AppError('Bạn không có quyền xác nhận voucher của đối tác này.', 403);
    }

    if (parsed.qrToken && parsed.qrToken !== row.qr_token) {
      throw new AppError('QR voucher không hợp lệ hoặc đã bị thay đổi.', 409);
    }

    await markExpiredIfNeeded(client, row);

    if (row.partner_status !== 'ACTIVE') {
      throw new AppError('Đối tác hiện không hoạt động.', 409);
    }

    if (normalizeStatus(row.status) !== 'ISSUED') {
      if (normalizeStatus(row.status) === 'USED') {
        throw new AppError('Voucher này đã được sử dụng trước đó.', 409);
      }
      if (row.status === 'EXPIRED') {
        throw new AppError('Voucher này đã hết hạn.', 409);
      }
      throw new AppError('Voucher này không còn hiệu lực.', 409);
    }

    const updated = await client.query(
      `UPDATE voucher_redemptions
       SET status = 'USED',
           used_at = NOW(),
           redeemed_at = COALESCE(redeemed_at, NOW()),
           used_by_user_id = $2,
           used_partner_id = $3
       WHERE id = $1
         AND status = 'ISSUED'
       RETURNING id`,
      [row.id, userId, row.partner_id]
    );

    if (!updated.rows[0]) {
      throw new AppError('Voucher vừa được xử lý ở một thiết bị khác.', 409);
    }

    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, actor_user_id, partner_id, metadata
       )
       VALUES ($1, 'USED', $2, $3, $4::jsonb)`,
      [
        row.id,
        userId,
        row.partner_id,
        JSON.stringify({
          method: parsed.qrToken ? 'QR' : 'CODE',
          role: access.role || null
        })
      ]
    );

    return getRedemptionById(row.id, client);
  });
}

export async function redeemPartnerVoucherByCode({ userId, code }) {
  return usePartnerVoucher({ userId, code });
}

export async function addPartnerStaff({
  userId,
  partnerId,
  email
}) {
  return withTransaction(async (client) => {
    const allowed = await ownerAccessForPartner(userId, partnerId, client);
    if (!allowed) {
      throw new AppError('Chỉ chủ quán/OWNER mới có thể thêm nhân viên.', 403);
    }

    const { rows: userRows } = await client.query(
      `SELECT id, name, email, account_status
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [String(email || '').trim()]
    );
    const staffUser = userRows[0];

    if (!staffUser) {
      throw new AppError('Không tìm thấy tài khoản Hola Maps với email này.', 404);
    }
    if (staffUser.account_status && staffUser.account_status !== 'ACTIVE') {
      throw new AppError('Tài khoản nhân viên đang bị tạm khóa.', 409);
    }
    if (Number(staffUser.id) === Number(userId)) {
      throw new AppError('Tài khoản của bạn đã có quyền OWNER.', 409);
    }

    const { rows } = await client.query(
      `INSERT INTO partner_memberships (
         partner_id, user_id, role, status, created_by
       )
       VALUES ($1, $2, 'STAFF', 'ACTIVE', $3)
       ON CONFLICT (partner_id, user_id)
       DO UPDATE SET
         role = CASE
           WHEN partner_memberships.role = 'OWNER' THEN 'OWNER'
           ELSE 'STAFF'
         END,
         status = 'ACTIVE',
         updated_at = NOW()
       RETURNING id, partner_id, user_id, role, status, created_at, updated_at`,
      [partnerId, staffUser.id, userId]
    );

    const membership = rows[0];

    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, actor_user_id, partner_id, metadata
       )
       SELECT vr.id, 'STAFF_GRANTED', $1, $2, $3::jsonb
       FROM voucher_redemptions vr
       JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
       WHERE vc.partner_id = $2
       ORDER BY vr.id DESC
       LIMIT 1`,
      [
        userId,
        partnerId,
        JSON.stringify({
          staffUserId: String(staffUser.id),
          staffEmail: staffUser.email
        })
      ]
    ).catch(() => {});

    return {
      id: String(membership.id),
      partnerId: String(membership.partner_id),
      userId: String(membership.user_id),
      userName: staffUser.name,
      userEmail: staffUser.email,
      role: membership.role,
      status: membership.status,
      createdAt: membership.created_at,
      updatedAt: membership.updated_at
    };
  });
}

export async function updatePartnerStaffStatus({
  userId,
  membershipId,
  status
}) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT
         prm.id,
         prm.partner_id,
         prm.user_id,
         prm.role,
         u.name AS user_name,
         u.email AS user_email
       FROM partner_memberships prm
       JOIN users u ON u.id = prm.user_id
       WHERE prm.id = $1
       FOR UPDATE`,
      [membershipId]
    );
    const membership = rows[0];

    if (!membership) throw new AppError('Không tìm thấy nhân viên.', 404);
    if (membership.role !== 'STAFF') {
      throw new AppError('Không thể thay đổi tài khoản OWNER tại đây.', 409);
    }

    const allowed = await ownerAccessForPartner(userId, membership.partner_id, client);
    if (!allowed) {
      throw new AppError('Chỉ OWNER của đối tác mới có thể quản lý nhân viên.', 403);
    }

    const updated = await client.query(
      `UPDATE partner_memberships
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, partner_id, user_id, role, status, created_at, updated_at`,
      [membershipId, status]
    );

    return {
      id: String(updated.rows[0].id),
      partnerId: String(updated.rows[0].partner_id),
      userId: String(updated.rows[0].user_id),
      userName: membership.user_name,
      userEmail: membership.user_email,
      role: updated.rows[0].role,
      status: updated.rows[0].status,
      createdAt: updated.rows[0].created_at,
      updatedAt: updated.rows[0].updated_at
    };
  });
}

export async function updateManagedPlace({ userId, placeId, values }) {
  const access = await pool.query(
    `SELECT pm.role
     FROM place_managers pm
     WHERE pm.place_id = $1 AND pm.user_id = $2
     LIMIT 1`,
    [placeId, userId]
  );

  if (!access.rows[0]) {
    throw new AppError('Bạn không có quyền quản lý thông tin địa điểm này.', 403);
  }

  const columnMap = {
    phone: 'phone',
    website: 'website',
    openingHours: 'opening_hours',
    description: 'description'
  };

  const params = [];
  const sets = [];
  for (const [key, value] of Object.entries(values || {})) {
    const column = columnMap[key];
    if (!column) continue;
    params.push(value || null);
    sets.push(column + ' = $' + params.length);
  }

  if (!sets.length) {
    const current = await listManagedPlaces(userId);
    return current.find((item) => String(item.placeId) === String(placeId)) || null;
  }

  params.push(placeId);
  await pool.query(
    'UPDATE places SET ' + sets.join(', ') + ', updated_at = NOW() WHERE id = $' + params.length,
    params
  );

  const current = await listManagedPlaces(userId);
  return current.find((item) => String(item.placeId) === String(placeId)) || null;
}
