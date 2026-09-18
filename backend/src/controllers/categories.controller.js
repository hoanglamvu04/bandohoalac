import { asyncHandler } from '../utils/asyncHandler.js';
import { listCategories } from '../services/category.service.js';

export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await listCategories();
  res.json({ items: categories });
});
