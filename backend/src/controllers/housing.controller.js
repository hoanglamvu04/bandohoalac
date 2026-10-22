import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  getHousingListingByPlaceId,
  listHousingListings
} from '../services/housing.service.js';

export const listHousing = asyncHandler(async (req, res) => {
  const result = await listHousingListings(req.query);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(result);
});

export const getHousing = asyncHandler(async (req, res) => {
  const item = await getHousingListingByPlaceId(Number(req.params.placeId));
  if (!item) throw new AppError('Không tìm thấy phòng trọ.', 404);
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  res.json({ item });
});
