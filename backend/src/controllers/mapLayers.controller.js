import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  listMapFeatures,
  createMapFeature,
  updateMapFeature,
  archiveMapFeature
} from '../services/mapLayers.service.js';

function parseTypes(value) {
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

export const list = asyncHandler(async (req, res) => {
  const west = Number(req.query.west);
  const south = Number(req.query.south);
  const east = Number(req.query.east);
  const north = Number(req.query.north);

  const data = await listMapFeatures({
    types: parseTypes(req.query.types),
    west,
    south,
    east,
    north
  });

  res.json(data);
});

export const create = asyncHandler(async (req, res) => {
  const id = await createMapFeature(req.body, req.user.id);
  res.status(201).json({ id });
});

export const update = asyncHandler(async (req, res) => {
  const ok = await updateMapFeature(Number(req.params.id), req.body, req.user.id);
  if (!ok) throw new AppError('Map feature not found.', 404);
  res.json({ ok: true });
});

export const archive = asyncHandler(async (req, res) => {
  const ok = await archiveMapFeature(Number(req.params.id), req.user.id);
  if (!ok) throw new AppError('Map feature not found.', 404);
  res.json({ ok: true });
});
