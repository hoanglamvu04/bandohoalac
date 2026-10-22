import { Router } from 'express';
import {
  getHousing,
  listHousing
} from '../controllers/housing.controller.js';
import { validateQuery } from '../validators/validate.js';
import { housingListQuerySchema } from '../validators/housing.validators.js';

const router = Router();

router.get('/', validateQuery(housingListQuerySchema), listHousing);
router.get('/:placeId', getHousing);

export default router;
