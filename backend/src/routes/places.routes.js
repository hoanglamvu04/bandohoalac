import { Router } from 'express';
import {
  getPlaces, getPlace, getPlaceBySlugHandler, getNearby, getBounds
} from '../controllers/places.controller.js';
import { validateQuery } from '../validators/validate.js';
import { nearbyQuerySchema, boundsQuerySchema, listPlacesQuerySchema } from '../validators/place.validators.js';

const router = Router();

router.get('/nearby', validateQuery(nearbyQuerySchema), getNearby);
router.get('/bounds', validateQuery(boundsQuerySchema), getBounds);
router.get('/slug/:slug', getPlaceBySlugHandler);
router.get('/:id', getPlace);
router.get('/', validateQuery(listPlacesQuerySchema), getPlaces);

export default router;
