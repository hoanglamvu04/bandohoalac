import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  publicApiMeta,
  publicCategories,
  publicNearbyPlaces,
  publicPlaceById,
  publicPlaceBySlug,
  publicPlaces,
  publicPlacesBounds,
  publicPlacesGeoJson
} from '../services/publicIntegration.service.js';

function setPublicHeaders(res, {
  cacheControl = 'public, max-age=30, stale-while-revalidate=60',
  cacheStatus
} = {}) {
  res.set('X-Hola-API-Version', 'v1');
  res.set('Cache-Control', cacheControl);
  if (cacheStatus) res.set('X-Hola-Cache', cacheStatus);
}

export const getPublicApiMeta = asyncHandler(async (_req, res) => {
  setPublicHeaders(res, {
    cacheControl: 'public, max-age=300, stale-while-revalidate=600'
  });
  res.json({ data: publicApiMeta() });
});

export const getPublicCategories = asyncHandler(async (_req, res) => {
  const items = await publicCategories();
  setPublicHeaders(res, {
    cacheControl: 'public, max-age=300, stale-while-revalidate=600'
  });
  res.json({ data: { items }, meta: { count: items.length } });
});

export const getPublicPlaces = asyncHandler(async (req, res) => {
  const items = await publicPlaces(req.query);
  setPublicHeaders(res);
  res.json({
    data: { items },
    meta: {
      count: items.length,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0
    }
  });
});

export const getPublicPlacesBounds = asyncHandler(async (req, res) => {
  const { items, cacheStatus } = await publicPlacesBounds(req.query);
  setPublicHeaders(res, {
    cacheControl: 'public, max-age=5, stale-while-revalidate=25',
    cacheStatus
  });
  res.json({
    data: { items },
    meta: {
      count: items.length,
      bounds: {
        north: Number(req.query.north),
        south: Number(req.query.south),
        east: Number(req.query.east),
        west: Number(req.query.west)
      }
    }
  });
});

export const getPublicPlacesGeoJson = asyncHandler(async (req, res) => {
  const { collection, cacheStatus } = await publicPlacesGeoJson(req.query);
  setPublicHeaders(res, {
    cacheControl: 'public, max-age=5, stale-while-revalidate=25',
    cacheStatus
  });
  res.type('application/geo+json');
  res.json(collection);
});

export const getPublicNearbyPlaces = asyncHandler(async (req, res) => {
  const items = await publicNearbyPlaces(req.query);
  setPublicHeaders(res, {
    cacheControl: 'public, max-age=15, stale-while-revalidate=45'
  });
  res.json({
    data: { items },
    meta: {
      count: items.length,
      center: {
        lat: Number(req.query.lat),
        lng: Number(req.query.lng)
      },
      radius: Number(req.query.radius) || 5000
    }
  });
});

export const getPublicPlaceById = asyncHandler(async (req, res) => {
  const item = await publicPlaceById(req.params.id);
  if (!item) throw new AppError('Place not found.', 404);
  setPublicHeaders(res);
  res.json({ data: item });
});

export const getPublicPlaceBySlug = asyncHandler(async (req, res) => {
  const item = await publicPlaceBySlug(req.params.slug);
  if (!item) throw new AppError('Place not found.', 404);
  setPublicHeaders(res);
  res.json({ data: item });
});
