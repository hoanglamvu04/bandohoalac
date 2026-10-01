import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  createPartner,
  createVoucherCampaign,
  getPartnerAdmin,
  getVoucherCampaignAdmin,
  listPartnersAdmin,
  listRedemptionsAdmin,
  listVoucherCampaignsAdmin,
  markVoucherRedeemed,
  updatePartner,
  updateVoucherCampaign
} from '../services/reward.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

export const listPartnersAdminController = asyncHandler(async (req, res) => {
  const items = await listPartnersAdmin({
    q: req.query.q,
    status: req.query.status || 'ALL'
  });
  res.json({ items });
});

export const createPartnerAdminController = asyncHandler(async (req, res) => {
  const item = await createPartner(req.body, req.user.id);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_CREATED',
    entityType: 'PARTNER',
    entityId: item.id,
    metadata: { placeId: item.placeId, status: item.status },
    ...auditContextFromRequest(req)
  });
  res.status(201).json(item);
});

export const updatePartnerAdminController = asyncHandler(async (req, res) => {
  const existing = await getPartnerAdmin(Number(req.params.id));
  if (!existing) throw new AppError('Partner not found.', 404);
  const item = await updatePartner(Number(req.params.id), req.body, req.user.id);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_UPDATED',
    entityType: 'PARTNER',
    entityId: item.id,
    metadata: req.body,
    ...auditContextFromRequest(req)
  });
  res.json(item);
});

export const listVoucherCampaignsAdminController = asyncHandler(async (req, res) => {
  const items = await listVoucherCampaignsAdmin({
    status: req.query.status || 'ALL',
    partnerId: req.query.partnerId
  });
  res.json({ items });
});

export const createVoucherCampaignAdminController = asyncHandler(async (req, res) => {
  const item = await createVoucherCampaign(req.body, req.user.id);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'VOUCHER_CAMPAIGN_CREATED',
    entityType: 'VOUCHER_CAMPAIGN',
    entityId: item.id,
    metadata: { partnerId: item.partnerId, pointsCost: item.pointsCost, status: item.status },
    ...auditContextFromRequest(req)
  });
  res.status(201).json(item);
});

export const updateVoucherCampaignAdminController = asyncHandler(async (req, res) => {
  const existing = await getVoucherCampaignAdmin(Number(req.params.id));
  if (!existing) throw new AppError('Voucher campaign not found.', 404);
  const item = await updateVoucherCampaign(Number(req.params.id), req.body, req.user.id);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'VOUCHER_CAMPAIGN_UPDATED',
    entityType: 'VOUCHER_CAMPAIGN',
    entityId: item.id,
    metadata: req.body,
    ...auditContextFromRequest(req)
  });
  res.json(item);
});

export const listVoucherRedemptionsAdminController = asyncHandler(async (req, res) => {
  const items = await listRedemptionsAdmin({
    campaignId: req.query.campaignId,
    status: req.query.status || 'ALL'
  });
  res.json({ items });
});

export const markVoucherRedeemedAdminController = asyncHandler(async (req, res) => {
  const item = await markVoucherRedeemed(Number(req.params.id), req.user.id);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'ADMIN_VOUCHER_USED',
    entityType: 'VOUCHER_REDEMPTION',
    entityId: item.id,
    metadata: { code: item.code, campaignId: item.campaignId, userId: item.userId },
    ...auditContextFromRequest(req)
  });
  res.json(item);
});
