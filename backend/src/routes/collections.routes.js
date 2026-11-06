import { Router } from 'express';
import {
  addPlace,
  create,
  getMine,
  getPublic,
  listMine,
  remove,
  removePlace,
  replacePlaces,
  update
} from '../controllers/collections.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import {
  addCollectionPlaceSchema,
  createCollectionSchema,
  replaceCollectionPlacesSchema,
  updateCollectionSchema
} from '../validators/collections.validators.js';

const router = Router();

router.get('/mine', authenticate, listMine);
router.post('/', authenticate, validateBody(createCollectionSchema), create);
router.get('/public/:slug', getPublic);
router.get('/:id', authenticate, getMine);
router.patch('/:id', authenticate, validateBody(updateCollectionSchema), update);
router.delete('/:id', authenticate, remove);
router.post('/:id/places', authenticate, validateBody(addCollectionPlaceSchema), addPlace);
router.put('/:id/places', authenticate, validateBody(replaceCollectionPlacesSchema), replacePlaces);
router.delete('/:id/places/:placeId', authenticate, removePlace);

export default router;
