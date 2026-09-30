import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { getRedemptionById } from './reward.service.js';

export async function listManagedPlaces(userId) {
  const { rows } = await pool.query(
    `SELECT
       pm.place_id,
       pm.role AS manager_role,
       p.name,
       p.address,
       p.phone,
       p.website,
       p.opening_hours,
       pp.id AS partner_id,
       pp.partner_name,
       pp.status AS partner_status,
       prm.role AS partner_role,
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
     ORDER BY p.name ASC`,
    [userId]
  );

  return rows.map((row) => ({
    placeId: String(row.place_id),
    name: row.name,
    address: row.address,
    phone: row.phone,
    website: row.website,
    openingHours: row.opening_hours,
    image: row.image || null,
    managerRole: row.manager_role,
    partnerId: row.partner_id ? String(row.partner_id) : null,
    partnerName: row.partner_name || null,
    partnerStatus: row.partner_status || null,
    partnerRole: row.partner_role || null
  }));
}

export async function getPartnerDashboard(userId) {
  const managedPlaces = await listManagedPlaces(userId);

  const { rows: campaignRows } = await pool.query(
    `SELECT
       vc.id,
       vc.title,
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
     WHERE EXISTS (
       SELECT 1 FROM place_managers pm
       WHERE pm.place_id = pp.place_id AND pm.user_id = $1
     )
       OR EXISTS (
         SELECT 1 FROM partner_memberships prm
         WHERE prm.partner_id = pp.id
           AND prm.user_id = $1
           AND prm.status = 'ACTIVE'
       )
     ORDER BY vc.updated_at DESC`,
    [userId]
  );

  const { rows: redemptionRows } = await pool.query(
    `SELECT
       vr.id,
       vr.code,
       vr.status,
       vr.points_spent,
       vr.created_at,
       vr.redeemed_at,
       vc.title AS campaign_title,
       COALESCE(pp.partner_name, p.name) AS partner_name,
       p.name AS place_name,
       u.name AS user_name
     FROM voucher_redemptions vr
     JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
     JOIN place_partners pp ON pp.id = vc.partner_id
     JOIN places p ON p.id = pp.place_id
     JOIN users u ON u.id = vr.user_id
     WHERE EXISTS (
       SELECT 1 FROM place_managers pm
       WHERE pm.place_id = pp.place_id AND pm.user_id = $1
     )
       OR EXISTS (
         SELECT 1 FROM partner_memberships prm
         WHERE prm.partner_id = pp.id
           AND prm.user_id = $1
           AND prm.status = 'ACTIVE'
       )
     ORDER BY vr.created_at DESC
     LIMIT 100`,
    [userId]
  );

  const campaigns = campaignRows.map((row) => ({
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: row.partner_name,
    placeName: row.place_name,
    title: row.title,
    status: row.status,
    pointsCost: Number(row.points_cost || 0),
    quantityTotal: row.quantity_total === null ? null : Number(row.quantity_total),
    quantityRedeemed: Number(row.quantity_redeemed || 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at
  }));

  const recentRedemptions = redemptionRows.map((row) => ({
    id: String(row.id),
    code: row.code,
    status: row.status,
    pointsSpent: Number(row.points_spent || 0),
    createdAt: row.created_at,
    redeemedAt: row.redeemed_at,
    campaignTitle: row.campaign_title,
    partnerName: row.partner_name,
    placeName: row.place_name,
    userName: row.user_name
  }));

  const vouchersPending = recentRedemptions.filter((item) => item.status === 'ISSUED').length;
  const vouchersRedeemed = recentRedemptions.filter((item) => item.status === 'REDEEMED').length;

  return {
    hasAccess: managedPlaces.length > 0,
    managedPlaces,
    campaigns,
    recentRedemptions,
    stats: {
      managedPlaces: managedPlaces.length,
      campaigns: campaigns.length,
      vouchersIssued: vouchersPending + vouchersRedeemed,
      vouchersPending,
      vouchersRedeemed
    }
  };
}

export async function redeemPartnerVoucherByCode({ userId, code }) {
  return withTransaction(async (client) => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const { rows } = await client.query(
      `SELECT
         vr.id,
         vr.status,
         pp.id AS partner_id,
         pp.place_id
       FROM voucher_redemptions vr
       JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
       JOIN place_partners pp ON pp.id = vc.partner_id
       WHERE UPPER(vr.code) = $1
       FOR UPDATE`,
      [normalizedCode]
    );

    const redemption = rows[0];
    if (!redemption) throw new AppError('Không tìm thấy mã voucher.', 404);
    if (redemption.status !== 'ISSUED') {
      throw new AppError('Voucher này đã được xử lý hoặc không còn hiệu lực.', 409);
    }

    const accessResult = await client.query(
      `SELECT (
        EXISTS (
          SELECT 1 FROM place_managers pm
          WHERE pm.place_id = $1 AND pm.user_id = $3
        )
        OR EXISTS (
          SELECT 1 FROM partner_memberships prm
          WHERE prm.partner_id = $2 AND prm.user_id = $3 AND prm.status = 'ACTIVE'
        )
      ) AS allowed`,
      [redemption.place_id, redemption.partner_id, userId]
    );

    if (!accessResult.rows[0]?.allowed) {
      throw new AppError('Bạn không có quyền xác nhận voucher của đối tác này.', 403);
    }

    const updated = await client.query(
      `UPDATE voucher_redemptions
       SET status = 'REDEEMED', redeemed_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [redemption.id]
    );

    return getRedemptionById(updated.rows[0].id, client);
  });
}
