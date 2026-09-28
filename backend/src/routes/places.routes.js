import { Router } from 'express';
import {
  getPlaces, getPlace, getPlaceBySlugHandler, getNearby, getBounds
} from '../controllers/places.controller.js';
import { authenticate } from '../middleware/auth.js';
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
import { nearbyQuerySchema, boundsQuerySchema, listPlacesQuerySchema } from '../validators/place.validators.js';

const router = Router();

router.get('/nearby', validateQuery(nearbyQuerySchema), getNearby);
router.get('/bounds', validateQuery(boundsQuerySchema), getBounds);
router.get('/favorites/me', authenticate, getFavorites);
router.get('/slug/:slug', getPlaceBySlugHandler);

router.get('/:id/reviews', getReviews);
router.get('/:id/me', authenticate, getMine);
router.put('/:id/review', authenticate, validateBody(reviewSchema), saveReview);
router.delete('/:id/review', authenticate, removeReview);
router.post('/:id/favorite', authenticate, favorite);
router.delete('/:id/favorite', authenticate, unfavorite);
router.get('/:id', getPlace);
router.get('/', validateQuery(listPlacesQuerySchema), getPlaces);

export default router;
