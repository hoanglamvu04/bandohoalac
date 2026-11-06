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

const router = Router();

router.post('/trip', validateBody(tripDirectionsBodySchema), getTripDirectionsHandler);
router.get('/', validateQuery(directionsQuerySchema), getDirectionsHandler);

export default router;
