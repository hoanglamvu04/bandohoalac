import { asyncHandler } from '../utils/asyncHandler.js';
import { createContribution, listContributionsByUser } from '../services/contribution.service.js';
import { deleteStoredAssets, storeUploadedFiles } from '../services/storage.service.js';

export const create = asyncHandler(async (req, res) => {
  const { type, placeId, location, place, reason } = req.body;

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
        photos: uploadedAssets.map((asset) => asset.url),
        photoAssets: uploadedAssets
      }
    });

    res.status(201).json({
      id: contributionId,
      status: 'PENDING',
      message: 'Đóng góp đã được ghi nhận và đang chờ duyệt.'
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
