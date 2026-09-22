import { Router } from 'express';
import { getDirectionsHandler } from '../controllers/directions.controller.js';
import { validateQuery } from '../validators/validate.js';
import { directionsQuerySchema } from '../validators/directions.validators.js';

const router = Router();

router.get('/', validateQuery(directionsQuerySchema), getDirectionsHandler);

export default router;
