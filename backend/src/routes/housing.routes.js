import { Router } from 'express';
import {
  getHousing,
  listHousing
} from '../controllers/housing.controller.js';
import { listMyHousing, manageMyHousing } from '../controllers/housingLifecycle.controller.js';
import {
  compareHousing, listMySavedHousingSearches, createMySavedHousingSearch,
  toggleMySavedHousingSearch, removeMySavedHousingSearch
} from '../controllers/housingIntelligence.controller.js';
import { authenticate, requireAdminSecurity } from '../middleware/auth.js';
import { validateQuery, validateBody } from '../validators/validate.js';
import {
  housingListQuerySchema, housingManageActionSchema,
  createSavedHousingSchema, updateSavedHousingStatusSchema,
  housingCompareQuerySchema, savedHousingSearchIdSchema
} from '../validators/housing.validators.js';

const router = Router();

router.get('/', validateQuery(housingListQuerySchema), listHousing);
router.get('/compare', validateQuery(housingCompareQuerySchema), compareHousing);
router.get('/saved-searches', authenticate, listMySavedHousingSearches);
router.post('/saved-searches', authenticate,
  validateBody(createSavedHousingSchema), createMySavedHousingSearch);
router.patch('/saved-searches/:id', authenticate,
  validateBody(updateSavedHousingStatusSchema), toggleMySavedHousingSearch);
router.delete('/saved-searches/:id', authenticate, removeMySavedHousingSearch);
router.get('/mine', authenticate, listMyHousing);
router.patch('/:placeId/manage', authenticate, requireAdminSecurity, validateBody(housingManageActionSchema), manageMyHousing);
router.get('/:placeId', getHousing);

export default router;
