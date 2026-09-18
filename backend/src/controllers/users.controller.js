import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { findUserById, getUserBadges, getRecentActivity, toPublicUser } from '../services/user.service.js';
import { countPublishedPlacesByUser, countPhotosByUser } from '../services/place.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found.', 404);

  const [placesCount, photosCount, badges, recentActivity] = await Promise.all([
    countPublishedPlacesByUser(userId),
    countPhotosByUser(userId),
    getUserBadges(userId),
    getRecentActivity(userId)
  ]);

  const totalReviewed = user.approved_count + user.rejected_count;
  const approvalRate = totalReviewed > 0 ? Number((user.approved_count / totalReviewed).toFixed(2)) : null;

  res.json({
    user: toPublicUser(user),
    stats: {
      placesContributed: placesCount,
      photosContributed: photosCount,
      approvalRate
    },
    badges,
    recentActivity
  });
});
