import { asyncHandler } from '../utils/asyncHandler.js';
import {
  hideAdsForToday,
  listPublicAds
} from '../services/advertisement.service.js';

export const listAdvertisements = asyncHandler(async (req, res) => {
  const data = await listPublicAds(req.user?.id || null);
  res.json(data);
});

export const hideAdvertisementsToday = asyncHandler(async (req, res) => {
  const data = await hideAdsForToday(req.user.id);
  res.json(data);
});
