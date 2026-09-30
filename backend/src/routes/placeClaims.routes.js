import { Router } from 'express';
import {
  createClaim,
  listMyClaims
} from '../controllers/placeClaims.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import { createPlaceClaimSchema } from '../validators/placeClaim.validators.js';

const router = Router();

router.use(authenticate);
router.get('/me', listMyClaims);
router.post('/', validateBody(createPlaceClaimSchema), createClaim);

export default router;
