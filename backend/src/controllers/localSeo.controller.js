import { asyncHandler } from '../utils/asyncHandler.js';
import { getLocalSeoPageBySlug } from '../services/localSeo.service.js';
import { AppError } from '../utils/AppError.js';

export const getPublicLocalSeoData = asyncHandler(async (req, res) => {
  const result = await getLocalSeoPageBySlug(req.params.slug);
  if (!result) throw new AppError('Trang địa phương chưa được xuất bản hoặc chưa đạt điều kiện chất lượng.', 404);
  res.set('Cache-Control', 'public, max-age=60, must-revalidate');
  res.json(result);
});
