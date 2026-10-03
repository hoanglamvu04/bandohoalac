import { asyncHandler } from '../utils/asyncHandler.js';
import { createContribution, listContributionsByUser } from '../services/contribution.service.js';
import { deleteStoredAssets, storeUploadedFiles } from '../services/storage.service.js';
import {
  defaultRoadStatusExpiryHours,
  isRoadStatusContributionType
} from '../services/roadStatus.service.js';

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
    const contributionId = await createContribution({
      userId: req.user.id,
      placeId: placeId || null,
      type,
      payload: {
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
      }
    });

    res.status(201).json({
      id: contributionId,
      status: 'PENDING',
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
