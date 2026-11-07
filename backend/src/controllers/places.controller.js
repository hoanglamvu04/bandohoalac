import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  listFeaturedPlaces, listHomeSections, getPlaceById, getPlaceBySlug, getNearbyPlaces, getPlacesInBoundsCached
} from '../services/place.service.js';
import { smartListPlaces } from '../services/smartPlaceSearch.service.js';
import { getPlaceTrustSummary, recordPlaceActiveConfirmation } from '../services/placeTrust.service.js';

export const getPlaces = asyncHandler(async (req, res) => {
  const { q, category, minRating, limit, offset, radius } = req.query;
  const result = await smartListPlaces({ q, category, minRating, limit, offset, radius });
  res.json(result);
});

export const getHomeSections = asyncHandler(async (req, res) => {
  const sections = await listHomeSections({ limit: req.query.limit });
  res.json({ sections });
});

export const getFeatured = asyncHandler(async (req, res) => {
  const items = await listFeaturedPlaces({ limit: req.query.limit });
  res.json({ items });
});

export const getPlaceTrust = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  if (!Number.isInteger(placeId) || placeId <= 0) throw new AppError('Invalid place id.', 400);
  const trust = await getPlaceTrustSummary(placeId);
  if (!trust) throw new AppError('Place not found.', 404);
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
  res.json(trust);
});

export const confirmPlaceActive = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  if (!Number.isInteger(placeId) || placeId <= 0) throw new AppError('Invalid place id.', 400);
  const trust = await recordPlaceActiveConfirmation({
    placeId,
    actorUserId: req.user.id
  });
  res.json(trust);
});

export const getPlace = asyncHandler(async (req, res) => {
  const place = await getPlaceById(Number(req.params.id));
  if (!place || place.status !== 'PUBLISHED') throw new AppError('Place not found.', 404);
  res.json(place);
});

export const getPlaceBySlugHandler = asyncHandler(async (req, res) => {
  const place = await getPlaceBySlug(req.params.slug);
  if (!place || place.status !== 'PUBLISHED') throw new AppError('Place not found.', 404);
  res.json(place);
});

export const getNearby = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 5000;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const items = await getNearbyPlaces({
    lat,
    lng,
    radius,
    category: req.query.category,
    minRating: req.query.minRating,
    limit,
    offset
  });
  const total = Number(items[0]?.totalCount) || offset + items.length;
  res.json({
    center: { lat, lng },
    radius,
    items,
    total,
    hasMore: offset + items.length < total
  });
});

export const getBounds = asyncHandler(async (req, res) => {
  const { north, south, east, west } = req.query;
  const { items, total, hasMore, cacheStatus } = await getPlacesInBoundsCached({
    north: Number(north),
    south: Number(south),
    east: Number(east),
    west: Number(west),
    category: req.query.category,
    minRating: req.query.minRating,
    limit: req.query.limit,
    offset: req.query.offset
  });

  res.set('X-Hola-Cache', cacheStatus);
  res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=25');
  res.json({ items, total, hasMore });
});
