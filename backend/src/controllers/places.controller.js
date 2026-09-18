import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  listPlaces, getPlaceById, getPlaceBySlug, getNearbyPlaces, getPlacesInBounds
} from '../services/place.service.js';

export const getPlaces = asyncHandler(async (req, res) => {
  const { q, category, limit, offset } = req.query;
  const items = await listPlaces({ q, category, limit, offset });
  res.json({ items });
});

export const getPlace = asyncHandler(async (req, res) => {
  const place = await getPlaceById(Number(req.params.id));
  if (!place) throw new AppError('Place not found.', 404);
  res.json(place);
});

export const getPlaceBySlugHandler = asyncHandler(async (req, res) => {
  const place = await getPlaceBySlug(req.params.slug);
  if (!place) throw new AppError('Place not found.', 404);
  res.json(place);
});

export const getNearby = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 5000;
  const items = await getNearbyPlaces({ lat, lng, radius });
  res.json({ center: { lat, lng }, radius, items });
});

export const getBounds = asyncHandler(async (req, res) => {
  const { north, south, east, west } = req.query;
  const items = await getPlacesInBounds({
    north: Number(north), south: Number(south), east: Number(east), west: Number(west)
  });
  res.json({ items });
});
