import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { listManagedPlaces } from './partnerPortal.service.js';

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

function mapShift(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    userId: String(row.user_id),
    userName: row.user_name || null,
    partnerName: row.partner_name || row.place_name || null,
    placeName: row.place_name || null,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at || null,
    vouchersUsed: Number(row.vouchers_used || 0)
  };
}

const SHIFT_SELECT = `SELECT
  ps.*,
  u.name AS user_name,
  COALESCE(pp.partner_name, p.name) AS partner_name,
  p.name AS place_name,
  (
    SELECT COUNT(*)::int
    FROM voucher_redemptions vr
    WHERE vr.used_shift_id = ps.id
      AND vr.status IN ('USED', 'REDEEMED')
  ) AS vouchers_used
FROM partner_shifts ps
JOIN users u ON u.id = ps.user_id
JOIN place_partners pp ON pp.id = ps.partner_id
JOIN places p ON p.id = pp.place_id`;

export async function getPartnerScannerState(userId) {
  const managedPlaces = await listManagedPlaces(userId);
  const partners = managedPlaces
    .filter((item) => item.partnerId && item.partnerStatus === 'ACTIVE')
    .map((item) => ({
      partnerId: String(item.partnerId),
      partnerName: item.partnerName || item.name,
      placeId: String(item.placeId),
      placeName: item.name,
      address: item.address || null,
      role: item.partnerRole || item.managerRole || 'STAFF'
    }));

  if (!partners.length) {
    return { hasAccess: false, partners: [], openShifts: [], recentUsage: [] };
  }

  const partnerIds = partners.map((item) => Number(item.partnerId));
  const [shiftResult, recentResult] = await Promise.all([
    pool.query(
      SHIFT_SELECT +
        ` WHERE ps.user_id = $1
            AND ps.partner_id = ANY($2::bigint[])
            AND ps.status = 'OPEN'
          ORDER BY ps.started_at DESC`,
      [userId, partnerIds]
    ),
    pool.query(
      `SELECT
         vr.id,
         vr.code,
         COALESCE(vr.used_at, vr.redeemed_at) AS used_at,
         vc.title AS campaign_title,
         vc.voucher_value_text,
         COALESCE(pp.partner_name, p.name) AS partner_name,
         p.name AS place_name,
         customer.name AS customer_name,
         cashier.name AS cashier_name,
         vr.used_shift_id
       FROM voucher_redemptions vr
       JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
       JOIN place_partners pp ON pp.id = vc.partner_id
       JOIN places p ON p.id = pp.place_id
       JOIN users customer ON customer.id = vr.user_id
       LEFT JOIN users cashier ON cashier.id = vr.used_by_user_id
       WHERE vc.partner_id = ANY($1::bigint[])
         AND vr.status IN ('USED', 'REDEEMED')
       ORDER BY COALESCE(vr.used_at, vr.redeemed_at) DESC
       LIMIT 5`,
      [partnerIds]
    )
  ]);

  return {
    hasAccess: true,
    partners,
    openShifts: shiftResult.rows.map(mapShift),
    recentUsage: recentResult.rows.map((row) => ({
      id: String(row.id),
      code: row.code,
      usedAt: row.used_at,
      campaignTitle: row.campaign_title,
      voucherValueText: row.voucher_value_text || null,
      partnerName: row.partner_name,
      placeName: row.place_name,
      customerName: row.customer_name,
      cashierName: row.cashier_name || null,
      shiftId: row.used_shift_id ? String(row.used_shift_id) : null
    }))
  };
}

export async function startPartnerShift({ userId, partnerId }) {
  return withTransaction(async (client) => {
    const access = await accessForPartner(userId, partnerId, client);
    if (!access || access.partner_status !== 'ACTIVE') {
      throw new AppError('Bạn không có quyền mở ca tại đối tác này.', 403);
    }

    const existing = await client.query(
      SHIFT_SELECT +
        ` WHERE ps.partner_id = $1
            AND ps.user_id = $2
            AND ps.status = 'OPEN'
          LIMIT 1
          FOR UPDATE OF ps`,
      [partnerId, userId]
    );
    if (existing.rows[0]) return mapShift(existing.rows[0]);

    const inserted = await client.query(
      `INSERT INTO partner_shifts (partner_id, user_id, status)
       VALUES ($1, $2, 'OPEN')
       RETURNING id`,
      [partnerId, userId]
    );

    const details = await client.query(
      SHIFT_SELECT + ' WHERE ps.id = $1',
      [inserted.rows[0].id]
    );
    return mapShift(details.rows[0]);
  });
}

export async function endPartnerShift({ userId, shiftId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, user_id, status
       FROM partner_shifts
       WHERE id = $1
         AND user_id = $2
       FOR UPDATE`,
      [shiftId, userId]
    );
    const shift = current.rows[0];
    if (!shift) throw new AppError('Không tìm thấy ca làm việc.', 404);

    if (shift.status === 'OPEN') {
      await client.query(
        `UPDATE partner_shifts
         SET status = 'CLOSED',
             ended_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [shiftId]
      );
    }

    const result = await client.query(
      SHIFT_SELECT + ' WHERE ps.id = $1',
      [shiftId]
    );
    return mapShift(result.rows[0]);
  });
}

export async function getPartnerReconciliation({
  userId,
  period = 'today',
  partnerId = null
}) {
  const managedPlaces = await listManagedPlaces(userId);
  const ownerPartners = managedPlaces.filter(
    (item) => item.partnerId && item.canManageStaff && item.partnerStatus === 'ACTIVE'
  );

  if (!ownerPartners.length) {
    return {
      hasOwnerAccess: false,
      period,
      partners: [],
      summary: { vouchersUsed: 0, staffCount: 0, shiftsCount: 0 },
      byStaff: [],
      byCampaign: [],
      shifts: []
    };
  }

  let partnerIds = [...new Set(ownerPartners.map((item) => Number(item.partnerId)))];
  if (partnerId) {
    const selected = Number(partnerId);
    if (!partnerIds.includes(selected)) {
      throw new AppError('Bạn không có quyền đối soát đối tác này.', 403);
    }
    partnerIds = [selected];
  }

  const normalizedPeriod = ['today', '7d', '30d'].includes(period) ? period : 'today';
  const sinceSql = normalizedPeriod === 'today'
    ? "(DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')"
    : normalizedPeriod === '7d'
      ? "NOW() - INTERVAL '7 days'"
      : "NOW() - INTERVAL '30 days'";

  const summarySql = `SELECT
     COUNT(*) FILTER (WHERE vr.status IN ('USED', 'REDEEMED'))::int AS vouchers_used,
     COUNT(DISTINCT vr.used_by_user_id) FILTER (WHERE vr.used_by_user_id IS NOT NULL)::int AS staff_count,
     COUNT(DISTINCT vr.used_shift_id) FILTER (WHERE vr.used_shift_id IS NOT NULL)::int AS shifts_count
   FROM voucher_redemptions vr
   JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
   WHERE vc.partner_id = ANY($1::bigint[])
     AND COALESCE(vr.used_at, vr.redeemed_at) >= ` + sinceSql;

  const staffSql = `SELECT
     vr.used_by_user_id AS user_id,
     COALESCE(u.name, 'Không xác định') AS user_name,
     COUNT(*)::int AS vouchers_used,
     MIN(COALESCE(vr.used_at, vr.redeemed_at)) AS first_used_at,
     MAX(COALESCE(vr.used_at, vr.redeemed_at)) AS last_used_at
   FROM voucher_redemptions vr
   JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
   LEFT JOIN users u ON u.id = vr.used_by_user_id
   WHERE vc.partner_id = ANY($1::bigint[])
     AND vr.status IN ('USED', 'REDEEMED')
     AND COALESCE(vr.used_at, vr.redeemed_at) >= ` + sinceSql + `
   GROUP BY vr.used_by_user_id, u.name
   ORDER BY vouchers_used DESC, user_name ASC`;

  const campaignSql = `SELECT
     vc.id AS campaign_id,
     vc.title,
     vc.voucher_value_text,
     COUNT(*)::int AS vouchers_used
   FROM voucher_redemptions vr
   JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
   WHERE vc.partner_id = ANY($1::bigint[])
     AND vr.status IN ('USED', 'REDEEMED')
     AND COALESCE(vr.used_at, vr.redeemed_at) >= ` + sinceSql + `
   GROUP BY vc.id, vc.title, vc.voucher_value_text
   ORDER BY vouchers_used DESC, vc.title ASC`;

  const shiftSql = SHIFT_SELECT +
    ` WHERE ps.partner_id = ANY($1::bigint[])
        AND ps.started_at >= ` + sinceSql + `
      ORDER BY ps.started_at DESC
      LIMIT 100`;

  const [summaryResult, staffResult, campaignResult, shiftResult] = await Promise.all([
    pool.query(summarySql, [partnerIds]),
    pool.query(staffSql, [partnerIds]),
    pool.query(campaignSql, [partnerIds]),
    pool.query(shiftSql, [partnerIds])
  ]);

  const raw = summaryResult.rows[0] || {};
  return {
    hasOwnerAccess: true,
    period: normalizedPeriod,
    partners: ownerPartners.map((item) => ({
      partnerId: String(item.partnerId),
      partnerName: item.partnerName || item.name,
      placeName: item.name
    })),
    summary: {
      vouchersUsed: Number(raw.vouchers_used || 0),
      staffCount: Number(raw.staff_count || 0),
      shiftsCount: Number(raw.shifts_count || 0)
    },
    byStaff: staffResult.rows.map((row) => ({
      userId: row.user_id ? String(row.user_id) : null,
      userName: row.user_name,
      vouchersUsed: Number(row.vouchers_used || 0),
      firstUsedAt: row.first_used_at,
      lastUsedAt: row.last_used_at
    })),
    byCampaign: campaignResult.rows.map((row) => ({
      campaignId: String(row.campaign_id),
      title: row.title,
      voucherValueText: row.voucher_value_text || null,
      vouchersUsed: Number(row.vouchers_used || 0)
    })),
    shifts: shiftResult.rows.map(mapShift)
  };
}
