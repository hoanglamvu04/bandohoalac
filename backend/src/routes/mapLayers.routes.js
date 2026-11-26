import { Router } from 'express';
import { list, create, update, archive } from '../controllers/mapLayers.controller.js';
import { authenticate, authorize, requireAdminSecurity } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import { createMapFeatureSchema, updateMapFeatureSchema } from '../validators/mapLayers.validators.js';

import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateQuery } from '../validators/validate.js';
import { areaSummarySchema } from '../validators/spatialDiscovery.validators.js';
import { getAreaSummary } from '../services/spatialDiscovery.service.js';
const router = Router();
router.get('/area-summary',rateLimit({windowMs:60000,limit:30,standardHeaders:true,legacyHeaders:false}),validateQuery(areaSummarySchema),asyncHandler(async(req,res)=>{
 res.set('Cache-Control','public, max-age=60');res.json(await getAreaSummary(req.query));
}));

router.get('/', list);
router.post('/', authenticate, authorize('MODERATOR', 'ADMIN'), requireAdminSecurity, validateBody(createMapFeatureSchema), create);
router.patch('/:id', authenticate, authorize('MODERATOR', 'ADMIN'), requireAdminSecurity, validateBody(updateMapFeatureSchema), update);
router.delete('/:id', authenticate, authorize('MODERATOR', 'ADMIN'), requireAdminSecurity, archive);

export default router;
