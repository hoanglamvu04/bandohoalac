import { asyncHandler } from '../utils/asyncHandler.js';
import { getDirections, getTripDirections } from '../services/directions.service.js';

export const getDirectionsHandler = asyncHandler(async (req, res) => {
  const originLat = Number(req.query.originLat);
  const originLng = Number(req.query.originLng);
  const destinationLat = Number(req.query.destinationLat);
  const destinationLng = Number(req.query.destinationLng);
  const profile = req.query.profile || 'driving';

  const route = await getDirections({
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    profile
  });

  res.json(route);
});

export const getTripDirectionsHandler = asyncHandler(async (req, res) => {
  const route = await getTripDirections(req.body);
  res.json(route);
});
