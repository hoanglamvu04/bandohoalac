import { Router } from 'express';
import {
  addItem,
  create,
  discover,
  getBySlug,
  getMine,
  remove,
  removeItem,
  update
} from '../controllers/collections.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import {
  addCollectionItemSchema,
  createCollectionSchema,
  updateCollectionSchema
} from '../validators/collection.validators.js';

const router = Router();

router.get('/discover', discover);
router.get('/public/:slug', optionalAuthenticate, getBySlug);
router.get('/me', authenticate, getMine);
router.post('/', authenticate, validateBody(createCollectionSchema), create);
router.patch('/:id', authenticate, validateBody(updateCollectionSchema), update);
router.delete('/:id', authenticate, remove);
router.post('/:id/items', authenticate, validateBody(addCollectionItemSchema), addItem);
router.delete('/:id/items/:placeId', authenticate, removeItem);

export default router;
