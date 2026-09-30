import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPlaceClaim,
  listMyPlaceClaims,
  listPlaceClaimsAdmin,
  reviewPlaceClaim
} from '../services/placeClaim.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

export const createClaim = asyncHandler(async (req, res) => {
  const item = await createPlaceClaim({
    ...req.body,
    userId: req.user.id
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_CLAIM_CREATED',
    entityType: 'PLACE_CLAIM',
    entityId: item.id,
    metadata: { placeId: item.placeId },
    ...auditContextFromRequest(req)
  });

  res.status(201).json(item);
});

export const listMyClaims = asyncHandler(async (req, res) => {
  const items = await listMyPlaceClaims(req.user.id);
  res.json({ items });
});

export const listClaimsAdmin = asyncHandler(async (req, res) => {
  const items = await listPlaceClaimsAdmin({
    status: req.query.status || 'ALL'
  });
  res.json({ items });
});

export const reviewClaimAdmin = asyncHandler(async (req, res) => {
  const item = await reviewPlaceClaim({
    claimId: Number(req.params.id),
    status: req.body.status,
    reviewNote: req.body.reviewNote,
    reviewedBy: req.user.id
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: req.body.status === 'APPROVED' ? 'PLACE_CLAIM_APPROVED' : 'PLACE_CLAIM_REJECTED',
    entityType: 'PLACE_CLAIM',
    entityId: item.id,
    metadata: {
      placeId: item.placeId,
      claimantUserId: item.userId,
      reviewNote: req.body.reviewNote || null
    },
    ...auditContextFromRequest(req)
  });

  await createNotification({
    userId: Number(item.userId),
    type: req.body.status === 'APPROVED' ? 'PLACE_CLAIM_APPROVED' : 'PLACE_CLAIM_REJECTED',
    title: req.body.status === 'APPROVED'
      ? 'Địa điểm đã được xác minh'
      : 'Yêu cầu xác minh chưa được duyệt',
    message: req.body.status === 'APPROVED'
      ? 'Bạn đã được cấp quyền quản lý ' + item.placeName + '.'
      : (req.body.reviewNote || 'Hola Maps cần thêm thông tin trước khi xác minh địa điểm này.'),
    data: {
      claimId: item.id,
      placeId: item.placeId,
      status: req.body.status
    }
  });

  res.json(item);
});
