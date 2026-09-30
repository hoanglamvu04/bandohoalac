import crypto from 'node:crypto';
import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

function mapPartner(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    placeName: row.place_name,
    placeAddress: row.place_address,
    placeImage: row.place_image || null,
    partnerName: row.partner_name || row.place_name,
    status: row.status,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    note: row.note,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCampaign(row) {
  if (!row) return null;
  const quantityTotal = row.quantity_total === null ? null : Number(row.quantity_total);
  const quantityRedeemed = Number(row.quantity_redeemed || 0);
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: row.partner_name || row.place_name,
    placeId: String(row.place_id),
    placeName: row.place_name,
    placeAddress: row.place_address,
    placeImage: row.place_image || null,
    title: row.title,
    description: row.description,
    voucherValueText: row.voucher_value_text,
    terms: row.terms,
    pointsCost: Number(row.points_cost || 0),
    quantityTotal,
    quantityRedeemed,
    quantityRemaining: quantityTotal === null ? null : Math.max(quantityTotal - quantityRedeemed, 0),
    maxPerUser: Number(row.max_per_user || 1),
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRedemption(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    campaignTitle: row.campaign_title,
    partnerName: row.partner_name || row.place_name,
    placeName: row.place_name,
    placeAddress: row.place_address,
    code: row.code,
    pointsSpent: Number(row.points_spent || 0),
    status: row.status,
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
    userId: row.user_id ? String(row.user_id) : null,
    userName: row.user_name || null,
    userEmail: row.user_email || null
  };
}

const PARTNER_SELECT = `
  SELECT
    pp.*,
    p.name AS place_name,
    p.address AS place_address,
    (
      SELECT pi.url
      FROM place_images pi
      WHERE pi.place_id = p.id
      ORDER BY pi.is_cover DESC, pi.id ASC
      LIMIT 1
    ) AS place_image
  FROM place_partners pp
  JOIN places p ON p.id = pp.place_id
`;

const CAMPAIGN_SELECT = `
  SELECT
    vc.*,
    pp.place_id,
    pp.partner_name,
    pp.status AS partner_status,
    p.name AS place_name,
    p.address AS place_address,
    (
      SELECT pi.url
      FROM place_images pi
      WHERE pi.place_id = p.id
      ORDER BY pi.is_cover DESC, pi.id ASC
      LIMIT 1
    ) AS place_image
  FROM voucher_campaigns vc
  JOIN place_partners pp ON pp.id = vc.partner_id
  JOIN places p ON p.id = pp.place_id
`;

const REDEMPTION_SELECT = `
  SELECT
    vr.*,
    vc.title AS campaign_title,
    pp.partner_name,
    p.name AS place_name,
    p.address AS place_address,
    u.name AS user_name,
    u.email AS user_email
  FROM voucher_redemptions vr
  JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
  JOIN place_partners pp ON pp.id = vc.partner_id
  JOIN places p ON p.id = pp.place_id
  JOIN users u ON u.id = vr.user_id
`;

export async function listPartnersAdmin({ q, status = 'ALL' } = {}) {
  const params = [];
  const conditions = [];

  if (q) {
    params.push('%' + String(q).trim() + '%');
    const ref = '$' + params.length;
    conditions.push('(p.name ILIKE ' + ref + ' OR pp.partner_name ILIKE ' + ref + ' OR p.address ILIKE ' + ref + ')');
  }

  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('pp.status = $' + params.length);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await pool.query(
    PARTNER_SELECT + where + ' ORDER BY pp.updated_at DESC',
    params
  );
  return rows.map(mapPartner);
}

export async function createPartner(data, adminId) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO place_partners (
        place_id, status, partner_name, contact_name, contact_phone,
        contact_email, note, joined_at, created_by, updated_by
      )
      SELECT
        p.id, $2, $3, $4, $5, $6, $7,
        CASE WHEN $2 = 'ACTIVE' THEN NOW() ELSE NULL END,
        $8, $8
      FROM places p
      WHERE p.id = $1
      RETURNING id`,
      [
        data.placeId,
        data.status || 'PENDING',
        data.partnerName || null,
        data.contactName || null,
        data.contactPhone || null,
        data.contactEmail || null,
        data.note || null,
        adminId
      ]
    );

    if (!rows[0]) throw new AppError('Place not found.', 404);

    await pool.query(
      `INSERT INTO partner_memberships (partner_id, user_id, role, status, created_by)
       SELECT $1, pm.user_id,
              CASE WHEN pm.role = 'OWNER' THEN 'OWNER' ELSE 'STAFF' END,
              'ACTIVE',
              $2
       FROM place_managers pm
       WHERE pm.place_id = $3
       ON CONFLICT (partner_id, user_id)
       DO UPDATE SET status = 'ACTIVE', updated_at = NOW()`,
      [rows[0].id, adminId, data.placeId]
    );

    return getPartnerAdmin(rows[0].id);
  } catch (error) {
    if (error?.code === '23505') throw new AppError('Địa điểm này đã được gắn hồ sơ đối tác.', 409);
    throw error;
  }
}

export async function getPartnerAdmin(id, client = pool) {
  const { rows } = await client.query(PARTNER_SELECT + ' WHERE pp.id = $1', [id]);
  return mapPartner(rows[0]);
}

export async function updatePartner(id, values, adminId) {
  const map = {
    status: 'status',
    partnerName: 'partner_name',
    contactName: 'contact_name',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    note: 'note'
  };
  const params = [];
  const sets = [];

  for (const [key, value] of Object.entries(values || {})) {
    if (!map[key]) continue;
    params.push(value);
    sets.push(map[key] + ' = $' + params.length);
    if (key === 'status' && value === 'ACTIVE') {
      sets.push('joined_at = COALESCE(joined_at, NOW())');
    }
  }

  if (!sets.length) return getPartnerAdmin(id);
  params.push(adminId);
  sets.push('updated_by = $' + params.length, 'updated_at = NOW()');
  params.push(id);

  const { rows } = await pool.query(
    'UPDATE place_partners SET ' + sets.join(', ') + ' WHERE id = $' + params.length + ' RETURNING id',
    params
  );
  if (!rows[0]) throw new AppError('Partner not found.', 404);
  return getPartnerAdmin(id);
}

export async function listVoucherCampaignsAdmin({ status = 'ALL', partnerId } = {}) {
  const params = [];
  const conditions = [];

  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('vc.status = $' + params.length);
  }
  if (partnerId) {
    params.push(Number(partnerId));
    conditions.push('vc.partner_id = $' + params.length);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await pool.query(
    CAMPAIGN_SELECT + where + ' ORDER BY vc.updated_at DESC',
    params
  );
  return rows.map(mapCampaign);
}

export async function getVoucherCampaignAdmin(id, client = pool) {
  const { rows } = await client.query(CAMPAIGN_SELECT + ' WHERE vc.id = $1', [id]);
  return mapCampaign(rows[0]);
}

export async function createVoucherCampaign(data, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO voucher_campaigns (
      partner_id, title, description, voucher_value_text, terms,
      points_cost, quantity_total, max_per_user, status,
      starts_at, ends_at, created_by, updated_by
    )
    SELECT
      pp.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
    FROM place_partners pp
    WHERE pp.id = $1
    RETURNING id`,
    [
      data.partnerId,
      data.title,
      data.description || null,
      data.voucherValueText || null,
      data.terms || null,
      data.pointsCost,
      data.quantityTotal ?? null,
      data.maxPerUser || 1,
      data.status || 'DRAFT',
      data.startsAt || null,
      data.endsAt || null,
      adminId
    ]
  );
  if (!rows[0]) throw new AppError('Partner not found.', 404);
  return getVoucherCampaignAdmin(rows[0].id);
}

export async function updateVoucherCampaign(id, values, adminId) {
  const map = {
    partnerId: 'partner_id',
    title: 'title',
    description: 'description',
    voucherValueText: 'voucher_value_text',
    terms: 'terms',
    pointsCost: 'points_cost',
    quantityTotal: 'quantity_total',
    maxPerUser: 'max_per_user',
    status: 'status',
    startsAt: 'starts_at',
    endsAt: 'ends_at'
  };

  const params = [];
  const sets = [];
  for (const [key, value] of Object.entries(values || {})) {
    if (!map[key]) continue;
    params.push(value);
    sets.push(map[key] + ' = $' + params.length);
  }

  if (!sets.length) return getVoucherCampaignAdmin(id);
  params.push(adminId);
  sets.push('updated_by = $' + params.length, 'updated_at = NOW()');
  params.push(id);

  const { rows } = await pool.query(
    'UPDATE voucher_campaigns SET ' + sets.join(', ') + ' WHERE id = $' + params.length + ' RETURNING id',
    params
  );
  if (!rows[0]) throw new AppError('Voucher campaign not found.', 404);
  return getVoucherCampaignAdmin(id);
}

export async function listPublicVoucherCampaigns(userId = null) {
  const { rows } = await pool.query(
    CAMPAIGN_SELECT +
    ` WHERE vc.status = 'ACTIVE'
       AND pp.status = 'ACTIVE'
       AND p.status = 'PUBLISHED'
       AND (vc.starts_at IS NULL OR vc.starts_at <= NOW())
       AND (vc.ends_at IS NULL OR vc.ends_at >= NOW())
       AND (vc.quantity_total IS NULL OR vc.quantity_redeemed < vc.quantity_total)
     ORDER BY vc.updated_at DESC`
  );

  let pointsBalance = null;
  const redeemedCounts = new Map();

  if (userId) {
    const [walletResult, redeemedResult] = await Promise.all([
      pool.query('SELECT points_balance FROM users WHERE id = $1', [userId]),
      pool.query(
        `SELECT campaign_id, COUNT(*)::int AS count
         FROM voucher_redemptions
         WHERE user_id = $1
           AND status IN ('ISSUED', 'REDEEMED')
         GROUP BY campaign_id`,
        [userId]
      )
    ]);
    pointsBalance = Number(walletResult.rows[0]?.points_balance || 0);
    for (const row of redeemedResult.rows) redeemedCounts.set(String(row.campaign_id), Number(row.count || 0));
  }

  return {
    pointsBalance,
    items: rows.map((row) => {
      const item = mapCampaign(row);
      const userRedeemedCount = redeemedCounts.get(String(row.id)) || 0;
      return {
        ...item,
        userRedeemedCount,
        canRedeem: userId
          ? pointsBalance >= item.pointsCost && userRedeemedCount < item.maxPerUser
          : false
      };
    })
  };
}

function generateVoucherCode() {
  return 'HOLA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function redeemVoucherCampaign({ campaignId, userId }) {
  return withTransaction(async (client) => {
    const campaignResult = await client.query(
      `SELECT
         vc.*, pp.status AS partner_status
       FROM voucher_campaigns vc
       JOIN place_partners pp ON pp.id = vc.partner_id
       WHERE vc.id = $1
       FOR UPDATE`,
      [campaignId]
    );
    const campaign = campaignResult.rows[0];

    if (!campaign) throw new AppError('Voucher campaign not found.', 404);
    if (campaign.status !== 'ACTIVE' || campaign.partner_status !== 'ACTIVE') {
      throw new AppError('Voucher này hiện không khả dụng.', 409);
    }
    const now = Date.now();
    if (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) {
      throw new AppError('Chiến dịch voucher chưa bắt đầu.', 409);
    }
    if (campaign.ends_at && new Date(campaign.ends_at).getTime() < now) {
      throw new AppError('Chiến dịch voucher đã kết thúc.', 409);
    }
    if (campaign.quantity_total !== null && Number(campaign.quantity_redeemed) >= Number(campaign.quantity_total)) {
      throw new AppError('Voucher đã hết lượt đổi.', 409);
    }

    const redeemedResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM voucher_redemptions
       WHERE campaign_id = $1
         AND user_id = $2
         AND status IN ('ISSUED', 'REDEEMED')`,
      [campaignId, userId]
    );
    if (Number(redeemedResult.rows[0]?.count || 0) >= Number(campaign.max_per_user || 1)) {
      throw new AppError('Bạn đã đạt giới hạn đổi của voucher này.', 409);
    }

    const userResult = await client.query(
      `SELECT id, points_balance
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new AppError('User not found.', 404);

    const cost = Number(campaign.points_cost);
    if (Number(user.points_balance || 0) < cost) {
      throw new AppError('Bạn chưa đủ điểm để đổi voucher này.', 409);
    }

    let code;
    let inserted;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = generateVoucherCode();
      try {
        const result = await client.query(
          `INSERT INTO voucher_redemptions (
             campaign_id, user_id, code, points_spent
           )
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [campaignId, userId, code, cost]
        );
        inserted = result.rows[0];
        break;
      } catch (error) {
        if (error?.code !== '23505') throw error;
      }
    }
    if (!inserted) throw new AppError('Không thể tạo mã voucher. Hãy thử lại.', 500);

    await client.query(
      `UPDATE users
       SET points_balance = points_balance - $1,
           updated_at = NOW()
       WHERE id = $2`,
      [cost, userId]
    );

    await client.query(
      `INSERT INTO points_transactions (user_id, contribution_id, amount, reason)
       VALUES ($1, NULL, $2, $3)`,
      [userId, -cost, 'VOUCHER_REDEMPTION:' + campaignId]
    );

    await client.query(
      `UPDATE voucher_campaigns
       SET quantity_redeemed = quantity_redeemed + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [campaignId]
    );

    return getRedemptionById(inserted.id, client);
  });
}

export async function getRedemptionById(id, client = pool) {
  const { rows } = await client.query(REDEMPTION_SELECT + ' WHERE vr.id = $1', [id]);
  return mapRedemption(rows[0]);
}

export async function listMyRedemptions(userId) {
  const [redemptions, wallet] = await Promise.all([
    pool.query(REDEMPTION_SELECT + ' WHERE vr.user_id = $1 ORDER BY vr.created_at DESC', [userId]),
    pool.query('SELECT points_balance FROM users WHERE id = $1', [userId])
  ]);
  return {
    pointsBalance: Number(wallet.rows[0]?.points_balance || 0),
    items: redemptions.rows.map(mapRedemption)
  };
}

export async function listRedemptionsAdmin({ campaignId, status = 'ALL' } = {}) {
  const conditions = [];
  const params = [];
  if (campaignId) {
    params.push(Number(campaignId));
    conditions.push('vr.campaign_id = $' + params.length);
  }
  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('vr.status = $' + params.length);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const { rows } = await pool.query(
    REDEMPTION_SELECT + where + ' ORDER BY vr.created_at DESC',
    params
  );
  return rows.map(mapRedemption);
}

export async function markVoucherRedeemed(id) {
  const { rows } = await pool.query(
    `UPDATE voucher_redemptions
     SET status = 'REDEEMED', redeemed_at = COALESCE(redeemed_at, NOW())
     WHERE id = $1
       AND status = 'ISSUED'
     RETURNING id`,
    [id]
  );
  if (!rows[0]) throw new AppError('Voucher không tồn tại hoặc đã được xử lý.', 409);
  return getRedemptionById(id);
}
