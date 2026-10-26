import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getPartnerAnalytics,
  recordPlaceEngagement
} from '../services/partnerAnalytics.service.js';

export const postPlaceEngagement = asyncHandler(async (req, res) => {
  await recordPlaceEngagement(req.params.id, req.body.eventType);
  res.set('Cache-Control', 'no-store').status(204).end();
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const report = await getPartnerAnalytics({
    userId: req.user.id,
    days: Number(req.query.days),
    placeId: req.query.placeId || null
  });
  res.set('Cache-Control', 'private, no-store').json(report);
});
