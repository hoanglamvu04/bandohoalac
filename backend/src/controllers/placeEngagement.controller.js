import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addFavorite,
  deleteReview,
  getFavoriteState,
  getMyReview,
  listFavorites,
  listPlaceReviews,
  removeFavorite,
  upsertReview
} from '../services/placeEngagement.service.js';

export const getReviews = asyncHandler(async (req, res) => {
  const items = await listPlaceReviews(Number(req.params.id), {
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.json({ items });
});

export const getMine = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const [review, favorite] = await Promise.all([
    getMyReview(placeId, req.user.id),
    getFavoriteState(placeId, req.user.id)
  ]);
  res.json({ review, favorite });
});

export const saveReview = asyncHandler(async (req, res) => {
  const review = await upsertReview({
    placeId: Number(req.params.id),
    userId: req.user.id,
    rating: Number(req.body.rating),
    comment: req.body.comment
  });
  res.json({ review });
});

export const removeReview = asyncHandler(async (req, res) => {
  await deleteReview(Number(req.params.id), req.user.id);
  res.status(204).end();
});

export const favorite = asyncHandler(async (req, res) => {
  const value = await addFavorite(Number(req.params.id), req.user.id);
  res.json({ favorite: value });
});

export const unfavorite = asyncHandler(async (req, res) => {
  const value = await removeFavorite(Number(req.params.id), req.user.id);
  res.json({ favorite: value });
});

export const getFavorites = asyncHandler(async (req, res) => {
  const items = await listFavorites(req.user.id);
  res.json({ items });
});
