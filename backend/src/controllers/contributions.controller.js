import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { createContribution, listContributionsByUser } from '../services/contribution.service.js';
import { deleteStoredAssets, storeUploadedFiles } from '../services/storage.service.js';
import {
  defaultRoadStatusExpiryHours,
  isRoadStatusContributionType
} from '../services/roadStatus.service.js';
import {
  buildContributionFingerprint,
  evaluateContributionRisk
} from '../services/contributionTrust.service.js';
import {
  getReputationHistory,
  getUserReputation
} from '../services/reputation.service.js';
import {
  expertisePriorityBoost,
  getDomainExpertise,
  getUserExpertise
} from '../services/expertise.service.js';

export const create = asyncHandler(async (req, res) => {
  const { type, placeId, location, place, reason, severity, expiresHours } = req.body;
  const isRoadStatus = isRoadStatusContributionType(type);
  const normalizedSeverity = isRoadStatus ? (severity || 'MEDIUM') : undefined;
  const ttlHours = isRoadStatus
    ? Number(expiresHours || defaultRoadStatusExpiryHours(type, normalizedSeverity))
    : null;
  const expiresAt = isRoadStatus
    ? new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
    : null;

  const uploadedAssets = await storeUploadedFiles(req.files || [], {
    scope: 'places',
    prefix: 'submission-user-' + req.user.id
  });

  try {
    const payload = {
      location,
      place,
      reason,
      ...(isRoadStatus ? {
        severity: normalizedSeverity,
        expiresAt,
        communityState: 'ACTIVE',
        sourceType: 'COMMUNITY'
      } : {}),
      photos: uploadedAssets.map((asset) => asset.url),
      photoAssets: uploadedAssets
    };

    const fingerprint = buildContributionFingerprint({ type, placeId, payload });
    const risk = await evaluateContributionRisk({
      userId: req.user.id,
      type,
      placeId: placeId || null,
      payload,
      fingerprint
    });

    if (risk.blocked) {
      throw new AppError(
        risk.blockReason || 'Đóng góp bị chặn do có dấu hiệu gửi lặp hoặc spam.',
        429
      );
    }

    const contributionId = await createContribution({
      userId: req.user.id,
      placeId: placeId || null,
      type,
      payload,
      riskScore: risk.score,
      riskFlags: risk.flags,
      fingerprint
    });

    const [reputation, domainExpertise] = await Promise.all([
      getUserReputation(req.user.id),
      getDomainExpertise(req.user.id, type)
    ]);
    const domainBoost = expertisePriorityBoost({ expertise: domainExpertise, reputation });
    const basePriority = Number(reputation?.permissions?.moderationPriority || 0);
    const effectivePriority = Math.min(4, basePriority + domainBoost);
    const priorityLabels = ['Tiêu chuẩn', 'Tiêu chuẩn+', 'Ưu tiên', 'Ưu tiên cao', 'Chuyên gia'];

    res.status(201).json({
      id: contributionId,
      status: 'PENDING',
      riskBand: risk.band,
      reviewPriority: priorityLabels[effectivePriority] || reputation?.permissions?.priorityLabel || 'Tiêu chuẩn',
      expertisePriorityBoost: domainBoost,
      domainExpertise: domainExpertise ? {
        key: domainExpertise.expertiseKey,
        label: domainExpertise.label,
        score: domainExpertise.score,
        tier: domainExpertise.tier
      } : null,
      expeditedReview: Boolean(reputation?.permissions?.expeditedReview || domainBoost > 0),
      message: isRoadStatus
        ? 'Đã ghi nhận tình trạng. Báo cáo cộng đồng sẽ tự hết hạn nếu không còn hiệu lực.'
        : 'Đóng góp đã được ghi nhận và đang chờ duyệt.'
    });
  } catch (error) {
    await deleteStoredAssets(uploadedAssets);
    throw error;
  }
});

export const listMine = asyncHandler(async (req, res) => {
  const items = await listContributionsByUser(req.user.id);
  res.json({ items });
});

export const getMyReputation = asyncHandler(async (req, res) => {
  const [reputation, history, expertise] = await Promise.all([
    getUserReputation(req.user.id),
    getReputationHistory(req.user.id, { limit: 8 }),
    getUserExpertise(req.user.id)
  ]);

  if (!reputation) throw new AppError('User not found.', 404);
  res.json({
    reputation: {
      ...reputation,
      version: '2.3',
      history,
      expertise
    }
  });
});
