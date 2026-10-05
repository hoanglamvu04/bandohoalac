import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { findUserById, getUserBadges, getRecentActivity, toPublicUser } from '../services/user.service.js';
import { getUserReputation } from '../services/reputation.service.js';
import {
  countPublishedPlacesByUser,
  countPhotosByUser,
  listPhotosByUser,
  listPublishedPlacesByUser
} from '../services/place.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found.', 404);

  const [
    placesCount,
    photosCount,
    badges,
    recentActivity,
    contributedPlaces,
    contributedPhotos,
    reputation
  ] = await Promise.all([
    countPublishedPlacesByUser(userId),
    countPhotosByUser(userId),
    getUserBadges(userId),
    getRecentActivity(userId),
    listPublishedPlacesByUser(userId),
    listPhotosByUser(userId),
    getUserReputation(userId)
  ]);

  const totalReviewed = Number(user.approved_count || 0) + Number(user.rejected_count || 0);
  const approvalRate = totalReviewed > 0
    ? Number((Number(user.approved_count || 0) / totalReviewed).toFixed(2))
    : null;

  res.json({
    user: toPublicUser(user, reputation),
    stats: {
      placesContributed: placesCount,
      photosContributed: photosCount,
      approvalRate,
      approvedContributions: Number(user.approved_count || 0),
      rejectedContributions: Number(user.rejected_count || 0),
      qualityPoints: Number(reputation?.metrics?.qualityPoints || 0),
      reputationScore: Number(reputation?.score || 0)
    },
    badges,
    recentActivity,
    contributedPlaces,
    contributedPhotos
  });
});
