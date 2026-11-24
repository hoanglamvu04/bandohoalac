import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicMarketInsights, getPublicHousingAmenities } from '../controllers/housingInsights.controller.js';
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
  housingCompareQuerySchema, savedHousingSearchIdSchema,
  marketInsightsQuerySchema, housingAmenitiesQuerySchema
} from '../validators/housing.validators.js';

const router = Router();

// Separate tighter limits for on-demand spatial/aggregate queries.
const housingInsightsLimiter = rateLimit({
  windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Bạn đang tra cứu quá nhanh. Vui lòng thử lại sau.' }
});

router.get('/market-insights', housingInsightsLimiter,
  validateQuery(marketInsightsQuerySchema), getPublicMarketInsights);
router.get('/:placeId/amenities', housingInsightsLimiter,
  validateQuery(housingAmenitiesQuerySchema), getPublicHousingAmenities);

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
