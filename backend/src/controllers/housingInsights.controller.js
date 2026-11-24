import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getHousingAskingPriceInsights, getHousingNearbyAmenities
} from '../services/housingInsights.service.js';
import { createReadThroughCache } from '../utils/readThroughCache.js';

const cachedMarket = createReadThroughCache({ ttlMs: 60000, maxEntries: 128 });
function marketKey(query) {
  // Only schema-approved public filter fields participate; never include
  // IP, contact, account/session IDs or raw search history.
  return JSON.stringify(['listingType','propertyType','west','south','east','north']
    .map((key) => query[key] === undefined ? '' : String(query[key])));
}

export const getPublicMarketInsights = asyncHandler(async (req, res) => {
  const data = await cachedMarket(marketKey(req.query),
    () => getHousingAskingPriceInsights(req.query));
  res.set('Cache-Control', 'public, max-age=60');
  res.json(data);
});

export const getPublicHousingAmenities = asyncHandler(async (req, res) => {
  const data = await getHousingNearbyAmenities(req.params.placeId, req.query.radius);
  res.set('Cache-Control', 'public, max-age=60');
  res.json(data);
});
