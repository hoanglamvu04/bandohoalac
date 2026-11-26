import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createViewing, listViewings, manageViewing } from '../controllers/housingViewings.controller.js';
import { getPublicMarketInsights, getPublicHousingAmenities } from '../controllers/housingInsights.controller.js';
import {
  getHousing,
  revealHousingContact,
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
  marketInsightsQuerySchema, housingAmenitiesQuerySchema, createHousingViewingSchema, manageHousingViewingSchema
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
const viewingLimiter=rateLimit({windowMs:60_000,limit:10,standardHeaders:true,legacyHeaders:false,
  keyGenerator:req=>'housing-viewing-'+req.user.id,
  message:{error:'Bạn thao tác lịch xem quá nhanh. Vui lòng thử lại.'}});
router.get('/viewings',authenticate,listViewings);
router.patch('/viewings/:id',authenticate,viewingLimiter,validateBody(manageHousingViewingSchema),manageViewing);
router.post('/:placeId/viewings',authenticate,viewingLimiter,validateBody(createHousingViewingSchema),createViewing);
const contactRevealLimiter = rateLimit({
  windowMs: 60_000, limit: 12, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => 'housing-member-' + req.user.id,
  message: { error: 'Bạn đã xem quá nhiều số liên hệ. Hãy thử lại sau.' }
});
// Token+active session is resolved on every request; details are not sent on
// any public endpoint and are never preloaded by the frontend.
router.get('/:placeId/contact', authenticate, contactRevealLimiter, revealHousingContact);
router.patch('/:placeId/manage', authenticate, requireAdminSecurity, validateBody(housingManageActionSchema), manageMyHousing);
router.get('/:placeId', getHousing);

export default router;
