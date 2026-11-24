import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getHousingAskingPriceInsights, getHousingNearbyAmenities
} from '../services/housingInsights.service.js';

export const getPublicMarketInsights = asyncHandler(async (req, res) => {
  const data = await getHousingAskingPriceInsights(req.query);
  res.set('Cache-Control', 'public, max-age=60');
  res.json(data);
});

export const getPublicHousingAmenities = asyncHandler(async (req, res) => {
  const data = await getHousingNearbyAmenities(req.params.placeId, req.query.radius);
  res.set('Cache-Control', 'public, max-age=60');
  res.json(data);
});
