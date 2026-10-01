import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

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

  return { code: code.toUpperCase(), qrToken };
}

function parseMoneyText(value) {
  const raw = String(value || '').toLowerCase().replace(/\u00a0/g, ' ');
  if (!raw) return 0;

  const compact = raw.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|nghin|ngàn|ngan)\b/i);
  if (compact) {
    const number = Number(String(compact[1]).replace(',', '.'));
    if (Number.isFinite(number) && number > 0) return Math.round(number * 1000);
  }

  const money = raw.match(/\d[\d., ]*/);
  if (!money) return 0;
  const digits = money[0].replace(/\D/g, '');
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : 0;
}

function resolveVoucherAmount(row) {
  const snapshot = Number(row.voucher_face_value_amount || 0);
  if (snapshot > 0) return snapshot;
  const configured = Number(row.voucher_value_amount || 0);
  if (configured > 0) return configured;
  return parseMoneyText(row.voucher_value_text);
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

async function selectVoucher(client, { code, id, lock = false }) {
  const params = [];
  const conditions = [];
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
       vr.voucher_face_value_amount,
       vr.customer_discount_amount,
       vr.partner_receivable_amount,
       vr.hola_payable_amount,
       vr.settlement_status,
       vr.settlement_batch_id,
       vc.title AS campaign_title,
       vc.status AS campaign_status,
       vc.voucher_value_text,
       vc.voucher_value_amount,
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
     ${lock ? 'FOR UPDATE OF vr' : ''}`,
    params
  );

  return rows[0] || null;
}

function inspectionPayload(row, valid, message) {
  const amount = resolveVoucherAmount(row);
  return {
    id: String(row.id),
    code: row.code,
    status: normalizeStatus(row.status),
    valid,
    message,
    campaignId: String(row.campaign_id),
    campaignTitle: row.campaign_title,
    voucherValueText: row.voucher_value_text || null,
    voucherValueAmount: amount || null,
    customerDiscountAmount: Number(row.customer_discount_amount || 0) || amount || null,
    partnerReceivableAmount: Number(row.partner_receivable_amount || 0) || amount || null,
    holaPayableAmount: Number(row.hola_payable_amount || 0) || amount || null,
    settlementStatus: row.settlement_status || null,
    settlementBatchId: row.settlement_batch_id ? String(row.settlement_batch_id) : null,
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
  if (row.status === 'ISSUED' && expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    await client.query(
      `UPDATE voucher_redemptions
       SET status = 'EXPIRED'
       WHERE id = $1 AND status = 'ISSUED'`,
      [row.id]
    );
    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, partner_id, metadata
       ) VALUES ($1, 'EXPIRED', $2, $3::jsonb)`,
      [row.id, row.partner_id, JSON.stringify({ expiresAt })]
    );
    row.status = 'EXPIRED';
  }
}

function assertExpectedPartner(row, partnerId) {
  if (partnerId && Number(partnerId) !== Number(row.partner_id)) {
    throw new AppError('Voucher này không thuộc quán đang được chọn trên máy quét.', 403);
  }
}

export async function inspectFinancialPartnerVoucher({
  userId,
  code,
  qrToken = null,
  partnerId = null
}) {
  return withTransaction(async (client) => {
    const parsed = parseVoucherInput(code, qrToken);
    if (!parsed.code) throw new AppError('Nhập hoặc quét mã voucher.', 400);

    const row = await selectVoucher(client, { code: parsed.code, lock: true });
    if (!row) throw new AppError('Không tìm thấy mã voucher.', 404);

    assertExpectedPartner(row, partnerId);

    const access = await accessForPartner(userId, row.partner_id, client);
    if (!access) {
      throw new AppError('Voucher này không thuộc địa điểm bạn được phép xác nhận.', 403);
    }

    if (parsed.qrToken && parsed.qrToken !== row.qr_token) {
      throw new AppError('QR voucher không hợp lệ hoặc đã bị thay đổi.', 409);
    }

    await markExpiredIfNeeded(client, row);

    const status = normalizeStatus(row.status);
    const amount = resolveVoucherAmount(row);
    let valid = status === 'ISSUED'
      && row.partner_status === 'ACTIVE'
      && row.campaign_status === 'ACTIVE'
      && amount > 0;
    let message = 'Voucher hợp lệ. Xác nhận để giảm cho khách và ghi nhận công nợ Hola Map.';

    if (row.partner_status !== 'ACTIVE') {
      valid = false;
      message = 'Đối tác hiện không ở trạng thái hoạt động.';
    } else if (row.campaign_status !== 'ACTIVE') {
      valid = false;
      message = 'Chiến dịch voucher hiện không hoạt động.';
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
    } else if (amount <= 0) {
      valid = false;
      message = 'Chiến dịch chưa cấu hình giá trị tiền để đối soát. Hãy liên hệ Hola Map.';
    }

    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, actor_user_id, partner_id, metadata
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        row.id,
        parsed.qrToken ? 'SCANNED' : 'LOOKUP',
        userId,
        row.partner_id,
        JSON.stringify({
          valid,
          status,
          role: access.role || null,
          voucherValueAmount: amount || null
        })
      ]
    );

    return inspectionPayload(row, valid, message);
  });
}

export async function useFinancialPartnerVoucher({
  userId,
  redemptionId = null,
  code = null,
  qrToken = null,
  partnerId = null,
  shiftId = null
}) {
  return withTransaction(async (client) => {
    const parsed = parseVoucherInput(code, qrToken);
    const row = await selectVoucher(client, {
      id: redemptionId,
      code: parsed.code,
      lock: true
    });

    if (!row) throw new AppError('Không tìm thấy voucher.', 404);
    if (!parsed.code && !parsed.qrToken) {
      throw new AppError('Cần mã voucher hoặc QR hợp lệ để xác nhận sử dụng.', 400);
    }
    if (parsed.code && parsed.code !== String(row.code || '').toUpperCase()) {
      throw new AppError('Mã voucher không khớp với lượt xác nhận này.', 409);
    }

    assertExpectedPartner(row, partnerId);

    const access = await accessForPartner(userId, row.partner_id, client);
    if (!access) throw new AppError('Bạn không có quyền xác nhận voucher của đối tác này.', 403);

    let activeShift = null;
    if (shiftId) {
      const shiftResult = await client.query(
        `SELECT id
         FROM partner_shifts
         WHERE id = $1
           AND partner_id = $2
           AND user_id = $3
           AND status = 'OPEN'
         FOR UPDATE`,
        [Number(shiftId), row.partner_id, userId]
      );
      activeShift = shiftResult.rows[0] || null;
      if (!activeShift) throw new AppError('Ca làm việc không còn hoạt động.', 409);
    }

    if (parsed.qrToken && parsed.qrToken !== row.qr_token) {
      throw new AppError('QR voucher không hợp lệ hoặc đã bị thay đổi.', 409);
    }

    await markExpiredIfNeeded(client, row);

    if (row.partner_status !== 'ACTIVE') throw new AppError('Đối tác hiện không hoạt động.', 409);
    if (row.campaign_status !== 'ACTIVE') throw new AppError('Chiến dịch voucher hiện không hoạt động.', 409);

    if (normalizeStatus(row.status) !== 'ISSUED') {
      if (normalizeStatus(row.status) === 'USED') {
        throw new AppError('Voucher này đã được sử dụng trước đó.', 409);
      }
      if (row.status === 'EXPIRED') throw new AppError('Voucher này đã hết hạn.', 409);
      throw new AppError('Voucher này không còn hiệu lực.', 409);
    }

    const amount = resolveVoucherAmount(row);
    if (amount <= 0) {
      throw new AppError('Voucher chưa có giá trị tiền để ghi nhận đối soát.', 409);
    }

    const updated = await client.query(
      `UPDATE voucher_redemptions
       SET status = 'USED',
           used_at = NOW(),
           redeemed_at = COALESCE(redeemed_at, NOW()),
           used_by_user_id = $2,
           used_partner_id = $3,
           used_shift_id = $4,
           voucher_face_value_amount = COALESCE(voucher_face_value_amount, $5),
           customer_discount_amount = $5,
           partner_receivable_amount = $5,
           hola_payable_amount = $5,
           settlement_status = 'UNPAID',
           settlement_batch_id = NULL
       WHERE id = $1
         AND status = 'ISSUED'
       RETURNING id`,
      [row.id, userId, row.partner_id, activeShift?.id || null, amount]
    );

    if (!updated.rows[0]) {
      throw new AppError('Voucher vừa được xử lý ở một thiết bị khác.', 409);
    }

    await client.query(
      `INSERT INTO voucher_redemption_events (
         redemption_id, event_type, actor_user_id, partner_id, metadata
       ) VALUES ($1, 'USED', $2, $3, $4::jsonb)`,
      [
        row.id,
        userId,
        row.partner_id,
        JSON.stringify({
          method: parsed.qrToken ? 'QR' : 'CODE',
          role: access.role || null,
          shiftId: activeShift?.id ? String(activeShift.id) : null,
          voucherValueAmount: amount,
          partnerReceivableAmount: amount,
          settlementStatus: 'UNPAID'
        })
      ]
    );

    const finalRow = await selectVoucher(client, { id: row.id });
    return inspectionPayload(
      finalRow,
      false,
      'Đã giảm cho khách và ghi nhận ' + amount.toLocaleString('vi-VN') + 'đ chờ Hola Map thanh toán.'
    );
  });
}
