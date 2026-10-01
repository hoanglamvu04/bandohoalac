import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addPartnerStaff,
  getPartnerDashboard,
  inspectPartnerVoucher,
  redeemPartnerVoucherByCode,
  updateManagedPlace,
  updatePartnerStaffStatus,
  usePartnerVoucher
} from '../services/partnerPortal.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await getPartnerDashboard(req.user.id);
  res.json(data);
});

export const inspectVoucherCode = asyncHandler(async (req, res) => {
  const item = await inspectPartnerVoucher({
    userId: req.user.id,
    code: req.body.code,
    qrToken: req.body.qrToken || null
  });

  res.json(item);
});

export const useVoucher = asyncHandler(async (req, res) => {
  const item = await usePartnerVoucher({
    userId: req.user.id,
    redemptionId: Number(req.params.id),
    code: req.body.code || null,
    qrToken: req.body.qrToken || null
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_VOUCHER_USED',
    entityType: 'VOUCHER_REDEMPTION',
    entityId: item.id,
    metadata: {
      code: item.code,
      campaignId: item.campaignId,
      userId: item.userId,
      partnerId: item.partnerId,
      method: req.body.qrToken ? 'QR' : 'CODE'
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});

// Backward-compatible endpoint for older clients.
export const redeemVoucherCode = asyncHandler(async (req, res) => {
  const item = await redeemPartnerVoucherByCode({
    userId: req.user.id,
    code: req.body.code
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_VOUCHER_USED',
    entityType: 'VOUCHER_REDEMPTION',
    entityId: item.id,
    metadata: {
      code: item.code,
      campaignId: item.campaignId,
      userId: item.userId,
      partnerId: item.partnerId,
      method: 'CODE'
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});

export const createPartnerStaff = asyncHandler(async (req, res) => {
  const item = await addPartnerStaff({
    userId: req.user.id,
    partnerId: Number(req.body.partnerId),
    email: req.body.email
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_STAFF_ADDED',
    entityType: 'PARTNER_MEMBERSHIP',
    entityId: item.id,
    metadata: {
      partnerId: item.partnerId,
      staffUserId: item.userId,
      staffEmail: item.userEmail,
      role: item.role
    },
    ...auditContextFromRequest(req)
  });

  res.status(201).json(item);
});

export const changePartnerStaffStatus = asyncHandler(async (req, res) => {
  const item = await updatePartnerStaffStatus({
    userId: req.user.id,
    membershipId: Number(req.params.id),
    status: req.body.status
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_STAFF_STATUS_UPDATED',
    entityType: 'PARTNER_MEMBERSHIP',
    entityId: item.id,
    metadata: {
      partnerId: item.partnerId,
      staffUserId: item.userId,
      status: item.status
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});

export const updateManagedPlaceDetails = asyncHandler(async (req, res) => {
  const item = await updateManagedPlace({
    userId: req.user.id,
    placeId: Number(req.params.id),
    values: req.body
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_PLACE_UPDATED',
    entityType: 'PLACE',
    entityId: req.params.id,
    metadata: req.body,
    ...auditContextFromRequest(req)
  });

  res.json(item);
});
