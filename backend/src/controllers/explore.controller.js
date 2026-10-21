import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  getExploreArticleBySlug,
  listExploreArticles
} from '../services/explore.service.js';

export const listExplore = asyncHandler(async (req, res) => {
  const result = await listExploreArticles({
    category: req.query.category,
    q: req.query.q,
    limit: req.query.limit
  });

  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  res.json(result);
});

export const getExploreArticle = asyncHandler(async (req, res) => {
  const result = await getExploreArticleBySlug(req.params.slug);
  if (!result) throw new AppError('Bài viết không tồn tại.', 404);

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
  res.json(result);
});
