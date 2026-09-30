import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getPartnerDashboard,
  redeemPartnerVoucherByCode,
  updateManagedPlace
} from '../services/partnerPortal.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await getPartnerDashboard(req.user.id);
  res.json(data);
});

export const redeemVoucherCode = asyncHandler(async (req, res) => {
  const item = await redeemPartnerVoucherByCode({
    userId: req.user.id,
    code: req.body.code
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PARTNER_VOUCHER_REDEEMED',
    entityType: 'VOUCHER_REDEMPTION',
    entityId: item.id,
    metadata: {
      code: item.code,
      campaignId: item.campaignId,
      userId: item.userId
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
