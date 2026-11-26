import { Router } from 'express';
import {
  getDirectionsHandler,
  getTripDirectionsHandler
} from '../controllers/directions.controller.js';
import { validateBody, validateQuery } from '../validators/validate.js';
import {
  directionsQuerySchema,
  tripDirectionsBodySchema
} from '../validators/directions.validators.js';

import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { corridorSearchSchema } from '../validators/spatialDiscovery.validators.js';
import { searchRouteCorridor } from '../services/spatialDiscovery.service.js';

const router = Router();
const corridorLimiter=rateLimit({windowMs:60000,limit:20,standardHeaders:true,legacyHeaders:false});
router.post('/corridor',corridorLimiter,validateBody(corridorSearchSchema),asyncHandler(async(req,res)=>{
 res.set('Cache-Control','no-store');res.json(await searchRouteCorridor(req.body));
}));

router.post('/trip', validateBody(tripDirectionsBodySchema), getTripDirectionsHandler);
router.get('/', validateQuery(directionsQuerySchema), getDirectionsHandler);

export default router;
