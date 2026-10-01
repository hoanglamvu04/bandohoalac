import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

const AMOUNT_SQL = 'COALESCE(vr.partner_receivable_amount, vr.hola_payable_amount, vr.voucher_face_value_amount, vc.voucher_value_amount, 0)';

function mapBatch(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: row.partner_name || row.place_name || null,
    status: row.status,
    voucherCount: Number(row.voucher_count || 0),
    amountTotal: Number(row.amount_total || 0),
    periodFrom: row.period_from || null,
    periodTo: row.period_to || null,
    note: row.note || null,
    createdAt: row.created_at,
    paidAt: row.paid_at || null,
    createdByName: row.created_by_name || null,
    paidByName: row.paid_by_name || null
  };
}

const BATCH_SELECT = `SELECT
  psb.*,
  COALESCE(pp.partner_name, p.name) AS partner_name,
  p.name AS place_name,
  creator.name AS created_by_name,
  payer.name AS paid_by_name
FROM partner_settlement_batches psb
JOIN place_partners pp ON pp.id = psb.partner_id
JOIN places p ON p.id = pp.place_id
LEFT JOIN users creator ON creator.id = psb.created_by
LEFT JOIN users payer ON payer.id = psb.paid_by`;

export async function listAdminSettlements({ partnerId = null, status = 'ALL' } = {}) {
  const params = [];
  const conditions = [];
  if (partnerId) {
    params.push(Number(partnerId));
    conditions.push('psb.partner_id = $' + params.length);
  }
  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('psb.status = $' + params.length);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

  const [batchResult, partnerResult] = await Promise.all([
    pool.query(BATCH_SELECT + where + ' ORDER BY psb.created_at DESC LIMIT 250', params),
    pool.query(
      `SELECT
         pp.id AS partner_id,
         COALESCE(pp.partner_name, p.name) AS partner_name,
         p.name AS place_name,
         COUNT(*) FILTER (
           WHERE vr.status IN ('USED', 'REDEEMED') AND vr.settlement_status = 'UNPAID'
         )::int AS unpaid_voucher_count,
         COALESCE(SUM(${AMOUNT_SQL}) FILTER (
           WHERE vr.status IN ('USED', 'REDEEMED') AND vr.settlement_status = 'UNPAID'
         ), 0)::bigint AS unpaid_amount,
         COALESCE(SUM(${AMOUNT_SQL}) FILTER (
           WHERE vr.settlement_status = 'PROCESSING'
         ), 0)::bigint AS processing_amount,
         COALESCE(SUM(${AMOUNT_SQL}) FILTER (
           WHERE vr.settlement_status = 'PAID'
         ), 0)::bigint AS paid_amount
       FROM place_partners pp
       JOIN places p ON p.id = pp.place_id
       LEFT JOIN voucher_campaigns vc ON vc.partner_id = pp.id
       LEFT JOIN voucher_redemptions vr ON vr.campaign_id = vc.id
       GROUP BY pp.id, pp.partner_name, p.name
       ORDER BY unpaid_amount DESC, partner_name ASC`
    )
  ]);

  return {
    partners: partnerResult.rows.map((row) => ({
      partnerId: String(row.partner_id),
      partnerName: row.partner_name,
      placeName: row.place_name,
      unpaidVoucherCount: Number(row.unpaid_voucher_count || 0),
      unpaidAmount: Number(row.unpaid_amount || 0),
      processingAmount: Number(row.processing_amount || 0),
      paidAmount: Number(row.paid_amount || 0)
    })),
    batches: batchResult.rows.map(mapBatch)
  };
}

export async function createSettlementBatch({ adminId, partnerId, note = null }) {
  return withTransaction(async (client) => {
    const partner = await client.query(
      `SELECT pp.id, COALESCE(pp.partner_name, p.name) AS partner_name
       FROM place_partners pp
       JOIN places p ON p.id = pp.place_id
       WHERE pp.id = $1
       FOR UPDATE OF pp`,
      [partnerId]
    );
    if (!partner.rows[0]) throw new AppError('Partner not found.', 404);

    const redemptions = await client.query(
      `SELECT
         vr.id,
         COALESCE(vr.used_at, vr.redeemed_at) AS used_at,
         ${AMOUNT_SQL} AS amount
       FROM voucher_redemptions vr
       JOIN voucher_campaigns vc ON vc.id = vr.campaign_id
       WHERE vc.partner_id = $1
         AND vr.status IN ('USED', 'REDEEMED')
         AND vr.settlement_status = 'UNPAID'
         AND vr.settlement_batch_id IS NULL
         AND ${AMOUNT_SQL} > 0
       ORDER BY COALESCE(vr.used_at, vr.redeemed_at) ASC
       FOR UPDATE OF vr`,
      [partnerId]
    );

    if (!redemptions.rows.length) {
      throw new AppError('Đối tác này không có công nợ UNPAID để tạo đợt thanh toán.', 409);
    }

    const ids = redemptions.rows.map((row) => Number(row.id));
    const amountTotal = redemptions.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const periodFrom = redemptions.rows[0]?.used_at || null;
    const periodTo = redemptions.rows[redemptions.rows.length - 1]?.used_at || null;

    const batch = await client.query(
      `INSERT INTO partner_settlement_batches (
         partner_id, status, voucher_count, amount_total,
         period_from, period_to, note, created_by
       )
       VALUES ($1, 'PROCESSING', $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [partnerId, ids.length, amountTotal, periodFrom, periodTo, note || null, adminId]
    );

    const batchId = batch.rows[0].id;
    await client.query(
      `UPDATE voucher_redemptions
       SET settlement_status = 'PROCESSING',
           settlement_batch_id = $1
       WHERE id = ANY($2::bigint[])`,
      [batchId, ids]
    );

    const result = await client.query(BATCH_SELECT + ' WHERE psb.id = $1', [batchId]);
    return mapBatch(result.rows[0]);
  });
}

export async function markSettlementBatchPaid({ adminId, batchId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT * FROM partner_settlement_batches WHERE id = $1 FOR UPDATE`,
      [batchId]
    );
    const batch = current.rows[0];
    if (!batch) throw new AppError('Settlement batch not found.', 404);
    if (batch.status === 'PAID') {
      const existing = await client.query(BATCH_SELECT + ' WHERE psb.id = $1', [batchId]);
      return mapBatch(existing.rows[0]);
    }
    if (batch.status !== 'PROCESSING') {
      throw new AppError('Chỉ đợt đang PROCESSING mới có thể đánh dấu PAID.', 409);
    }

    await client.query(
      `UPDATE partner_settlement_batches
       SET status = 'PAID', paid_by = $2, paid_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [batchId, adminId]
    );
    await client.query(
      `UPDATE voucher_redemptions
       SET settlement_status = 'PAID'
       WHERE settlement_batch_id = $1
         AND settlement_status = 'PROCESSING'`,
      [batchId]
    );

    const result = await client.query(BATCH_SELECT + ' WHERE psb.id = $1', [batchId]);
    return mapBatch(result.rows[0]);
  });
}
