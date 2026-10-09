import { timingSafeEqual } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { resolveIntegrationSecret } from '../services/integrationSecrets.service.js';
import {
  deleteHaloPost,
  getHaloMediaForPlace,
  getHaloSpot,
  listHaloSpotFeatures,
  upsertHaloPost
} from '../services/haloHola.service.js';

function equalSecret(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function requestSecret(req) {
  const direct = String(req.get('x-halo-hola-key') || '').trim();
  if (direct) return direct;
  const authorization = String(req.get('authorization') || '').trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function assertHaloIntegration(req) {
  const configured = await resolveIntegrationSecret('HALO_HOLA');
  if (!configured.secret) {
    throw new AppError('HALO HOLA integration secret chưa được cấu hình.', 503);
  }
  if (!equalSecret(requestSecret(req), configured.secret)) {
    throw new AppError('HALO HOLA integration key không hợp lệ.', 401);
  }
}

export const syncHaloPost = asyncHandler(async (req, res) => {
  await assertHaloIntegration(req);
  const result = await upsertHaloPost(req.body || {});
  res.status(200).json(result);
});

export const removeHaloPost = asyncHandler(async (req, res) => {
  await assertHaloIntegration(req);
  res.json(await deleteHaloPost(req.params.externalPostId));
});

export const listHaloSpots = asyncHandler(async (req, res) => {
  const features = await listHaloSpotFeatures({
    west: req.query.west,
    south: req.query.south,
    east: req.query.east,
    north: req.query.north
  });
  res.json({ type: 'FeatureCollection', features });
});

export const readHaloSpot = asyncHandler(async (req, res) => {
  res.json(await getHaloSpot(req.params.id, { limit: req.query.limit }));
});

export const readHaloPlaceMedia = asyncHandler(async (req, res) => {
  const item = await getHaloMediaForPlace(req.params.placeId, { limit: req.query.limit });
  res.json({ item });
});
