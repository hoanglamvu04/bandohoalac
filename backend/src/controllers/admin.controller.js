import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { listContributions, getContributionById } from '../services/contribution.service.js';
import { approveContribution, rejectContribution } from '../services/admin.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';
import { invalidatePlaceBoundsCache } from '../services/place.service.js';
import { findNearbyPropertyCandidates, scanPendingPropertyRiskQueue } from '../services/realEstateDuplicates.service.js';

export const getContributions = asyncHandler(async (req, res) => {
  const { status, limit, offset } = req.query;
  const items = await listContributions({
    status,
    limit: Number(limit) || 50,
    offset: Number(offset) || 0
  });
  res.json({
    items: ['ADMIN', 'MODERATOR'].includes(req.user.role)
      ? items
      : items.filter((item) => item.placeCategorySlug !== 'bat-dong-san' &&
          !item.payload?.place?.realEstate &&
          !(item.type === 'CREATE_PLACE' && item.payload?.place?.categorySlug === 'bat-dong-san') &&
          item.payload?.place?.realEstatePriceVnd === undefined)
  });
});

export const getContribution = asyncHandler(async (req, res) => {
  const contribution = await getContributionById(Number(req.params.id));
  if (!contribution) throw new AppError('Contribution not found.', 404);
  if ((contribution.placeCategorySlug === 'bat-dong-san' ||
       contribution.payload?.place?.realEstate ||
       contribution.payload?.place?.realEstatePriceVnd !== undefined ||
       (contribution.type === 'CREATE_PLACE' && contribution.payload?.place?.categorySlug === 'bat-dong-san')) &&
      !['ADMIN', 'MODERATOR'].includes(req.user.role)) {
    throw new AppError('Tin bất động sản chỉ được xem bởi quản trị viên.', 403);
  }
  res.json(contribution);
});

export const getPendingPropertyRiskQueue = asyncHandler(async (req, res) => {
  const result = await scanPendingPropertyRiskQueue({
    limit: Number(req.query.limit),
    offset: Number(req.query.offset)
  });
  res.set('Cache-Control', 'private, no-store');
  res.json(result);
});

export const getRealEstateDuplicates = asyncHandler(async (req, res) => {
  const contribution = await getContributionById(Number(req.params.id));
  if (!contribution) throw new AppError('Contribution not found.', 404);
  const property = contribution.payload?.place;
  const location = contribution.payload?.location;
  if (!property?.realEstate || !location) return res.json({ items: [] });

  const result = await findNearbyPropertyCandidates({
    contributionId: contribution.id,
    payload: contribution.payload
  });
  res.set('Cache-Control', 'no-store');
  res.json(result);
});

export const approve = asyncHandler(async (req, res) => {
  const contribution = await approveContribution(
    Number(req.params.id),
    req.user,
    req.body || {}
  );
  invalidatePlaceBoundsCache();
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'CONTRIBUTION_APPROVED',
    entityType: 'CONTRIBUTION',
    entityId: contribution.id,
    metadata: {
      reviewerRole: req.user.role,
      reviewerCtvLevel: req.user.ctvLevel || null,
      userId: contribution.userId,
      type: contribution.type,
      placeId: contribution.placeId,
      riskScore: contribution.riskScore,
      pointsAwarded: contribution.moderation?.pointsAwarded ?? 0,
      maxPoints: contribution.moderation?.maxPoints ?? 20,
      scoreBreakdown: contribution.moderation?.scoreBreakdown || null,
      scoreNote: contribution.moderation?.scoreNote || null
    },
    ...auditContextFromRequest(req)
  });
  res.json(contribution);
});

export const reject = asyncHandler(async (req, res) => {
  const contribution = await rejectContribution(
    Number(req.params.id),
    req.user,
    req.body.reason
  );
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'CONTRIBUTION_REJECTED',
    entityType: 'CONTRIBUTION',
    entityId: contribution.id,
    metadata: {
      reviewerRole: req.user.role,
      reviewerCtvLevel: req.user.ctvLevel || null,
      userId: contribution.userId,
      type: contribution.type,
      riskScore: contribution.riskScore,
      reason: req.body.reason || null
    },
    ...auditContextFromRequest(req)
  });
  res.json(contribution);
});
