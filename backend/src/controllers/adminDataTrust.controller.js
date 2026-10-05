import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { getDataQualityOverview, markPlaceVerified } from '../services/dataQuality.service.js';
import { listPlaceRevisions, rollbackPlaceRevision } from '../services/placeRevision.service.js';
import { auditCtvModeration } from '../services/contributionTrust.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

export const getDataQualityAdmin = asyncHandler(async (req, res) => {
  const data = await getDataQualityOverview({ limit: Number(req.query.limit) || 100 });
  res.json(data);
});

export const verifyPlaceQualityAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const place = await markPlaceVerified({ placeId, actorUserId: req.user.id });
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_QUALITY_VERIFIED',
    entityType: 'PLACE',
    entityId: placeId,
    metadata: { qualityVerification: true },
    ...auditContextFromRequest(req)
  });
  res.json(place);
});

export const listPlaceRevisionsAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  if (!Number.isInteger(placeId) || placeId <= 0) throw new AppError('Invalid place id.', 400);
  const items = await listPlaceRevisions(placeId, { limit: Number(req.query.limit) || 50 });
  res.json({ items });
});

export const rollbackPlaceRevisionAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const revisionId = Number(req.params.revisionId);
  const result = await rollbackPlaceRevision({
    placeId,
    revisionId,
    actorUserId: req.user.id,
    reason: String(req.body?.reason || '').trim().slice(0, 500) || undefined
  });
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_REVISION_ROLLED_BACK',
    entityType: 'PLACE',
    entityId: placeId,
    metadata: { revisionId, reason: req.body?.reason || null },
    ...auditContextFromRequest(req)
  });
  res.json(result);
});

export const auditCtvModerationAdmin = asyncHandler(async (req, res) => {
  const contributionId = Number(req.params.id);
  const verdict = req.body?.verdict;
  if (!['CONFIRMED', 'OVERTURNED'].includes(verdict)) {
    throw new AppError('Invalid CTV audit verdict.', 400);
  }
  const result = await auditCtvModeration({
    contributionId,
    adminId: req.user.id,
    verdict,
    note: String(req.body?.note || '').trim().slice(0, 1000) || null
  });
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'CTV_MODERATION_AUDITED',
    entityType: 'CONTRIBUTION',
    entityId: contributionId,
    metadata: { verdict, ...result },
    ...auditContextFromRequest(req)
  });
  res.json(result);
});
