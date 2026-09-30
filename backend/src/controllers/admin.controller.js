import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { listContributions, getContributionById } from '../services/contribution.service.js';
import { approveContribution, rejectContribution } from '../services/admin.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

export const getContributions = asyncHandler(async (req, res) => {
  const { status, limit, offset } = req.query;
  const items = await listContributions({
    status,
    limit: Number(limit) || 50,
    offset: Number(offset) || 0
  });
  res.json({ items });
});

export const getContribution = asyncHandler(async (req, res) => {
  const contribution = await getContributionById(Number(req.params.id));
  if (!contribution) throw new AppError('Contribution not found.', 404);
  res.json(contribution);
});

export const approve = asyncHandler(async (req, res) => {
  const contribution = await approveContribution(Number(req.params.id), req.user.id);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'CONTRIBUTION_APPROVED',
    entityType: 'CONTRIBUTION',
    entityId: contribution.id,
    metadata: { userId: contribution.userId, type: contribution.type, placeId: contribution.placeId },
    ...auditContextFromRequest(req)
  });
  res.json(contribution);
});

export const reject = asyncHandler(async (req, res) => {
  const contribution = await rejectContribution(Number(req.params.id), req.user.id, req.body.reason);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'CONTRIBUTION_REJECTED',
    entityType: 'CONTRIBUTION',
    entityId: contribution.id,
    metadata: { userId: contribution.userId, type: contribution.type, reason: req.body.reason || null },
    ...auditContextFromRequest(req)
  });
  res.json(contribution);
});
