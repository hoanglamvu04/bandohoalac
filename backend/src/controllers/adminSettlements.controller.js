import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createSettlementBatch,
  listAdminSettlements,
  markSettlementBatchPaid
} from '../services/settlement.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const listPartnerSettlementsAdmin = asyncHandler(async (req, res) => {
  const data = await listAdminSettlements({
    partnerId: req.query.partnerId || null,
    status: req.query.status || 'ALL'
  });
  res.json(data);
});

export const createPartnerSettlementAdmin = asyncHandler(async (req, res) => {
  const item = await createSettlementBatch({
    adminId: req.user.id,
    partnerId: Number(req.body.partnerId),
    note: req.body.note || null
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_SETTLEMENT_CREATED',
    entityType: 'PARTNER_SETTLEMENT',
    entityId: item.id,
    metadata: {
      partnerId: item.partnerId,
      voucherCount: item.voucherCount,
      amountTotal: item.amountTotal
    },
    ...auditContextFromRequest(req)
  });

  res.status(201).json(item);
});

export const markPartnerSettlementPaidAdmin = asyncHandler(async (req, res) => {
  const item = await markSettlementBatchPaid({
    adminId: req.user.id,
    batchId: Number(req.params.id)
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_SETTLEMENT_PAID',
    entityType: 'PARTNER_SETTLEMENT',
    entityId: item.id,
    metadata: {
      partnerId: item.partnerId,
      voucherCount: item.voucherCount,
      amountTotal: item.amountTotal
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});
