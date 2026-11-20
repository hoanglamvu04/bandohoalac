import { Router } from 'express';
import {
  getHousing,
  listHousing
} from '../controllers/housing.controller.js';
import { listMyHousing, manageMyHousing } from '../controllers/housingLifecycle.controller.js';
import { authenticate, requireAdminSecurity } from '../middleware/auth.js';
import { validateQuery, validateBody } from '../validators/validate.js';
import { housingListQuerySchema, housingManageActionSchema } from '../validators/housing.validators.js';

const router = Router();

router.get('/', validateQuery(housingListQuerySchema), listHousing);
router.get('/mine', authenticate, listMyHousing);
router.patch('/:placeId/manage', authenticate, requireAdminSecurity, validateBody(housingManageActionSchema), manageMyHousing);
router.get('/:placeId', getHousing);

export default router;
