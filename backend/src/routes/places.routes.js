import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getPlaces, getTravelTimePlaces, getFeatured, getHomeSections, getPlace, getPlaceBySlugHandler, getNearby, getBounds,
  getPlaceTrust, confirmPlaceActive
} from '../controllers/places.controller.js';
import { authenticate } from '../middleware/auth.js';
import { contributionRateLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateQuery } from '../validators/validate.js';
import {
  favorite,
  getFavorites,
  getMine,
  getReviews,
  removeReview,
  saveReview,
  unfavorite
} from '../controllers/placeEngagement.controller.js';
import { reviewSchema } from '../validators/review.validators.js';
import { nearbyQuerySchema, boundsQuerySchema, listPlacesQuerySchema, travelTimeQuerySchema } from '../validators/place.validators.js';

const router = Router();

// OSRM matrix is expensive; this endpoint has a stricter per-IP budget and
// an in-memory bounded coalescing cache in its service.
const travelTimeLimiter = rateLimit({
  windowMs: 60_000, limit: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Bạn đang tìm quá nhanh. Vui lòng thử lại sau.' }
});
router.get('/travel-time', travelTimeLimiter,
  validateQuery(travelTimeQuerySchema), getTravelTimePlaces);
router.get('/nearby', validateQuery(nearbyQuerySchema), getNearby);
router.get('/bounds', validateQuery(boundsQuerySchema), getBounds);
router.get('/favorites/me', authenticate, getFavorites);
router.get('/home-sections', getHomeSections);
router.get('/featured', getFeatured);
router.get('/slug/:slug', getPlaceBySlugHandler);

router.get('/:id/trust', getPlaceTrust);
router.post('/:id/confirm-active', authenticate, contributionRateLimiter, confirmPlaceActive);
router.get('/:id/reviews', getReviews);
router.get('/:id/me', authenticate, getMine);
router.put('/:id/review', authenticate, validateBody(reviewSchema), saveReview);
router.delete('/:id/review', authenticate, removeReview);
router.post('/:id/favorite', authenticate, favorite);
router.delete('/:id/favorite', authenticate, unfavorite);
router.get('/:id', getPlace);
router.get('/', validateQuery(listPlacesQuerySchema), getPlaces);

export default router;
