import { asyncHandler } from '../utils/asyncHandler.js';
import { createContribution, listContributionsByUser } from '../services/contribution.service.js';
import { getPublicUrls } from '../services/storage.service.js';

export const create = asyncHandler(async (req, res) => {
  const { type, placeId, location, place, reason } = req.body;
  const photoUrls = getPublicUrls((req.files || []).map((file) => file.filename));

  const contributionId = await createContribution({
    userId: req.user.id,
    placeId: placeId || null,
    type,
    payload: { location, place, reason, photos: photoUrls }
  });

  res.status(201).json({
    id: contributionId,
    status: 'PENDING',
    message: 'Đóng góp đã được ghi nhận và đang chờ duyệt.'
  });
});

export const listMine = asyncHandler(async (req, res) => {
  const items = await listContributionsByUser(req.user.id);
  res.json({ items });
});
