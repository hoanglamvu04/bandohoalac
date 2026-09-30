import { Router } from 'express';
import {
  getDashboard,
  redeemVoucherCode
} from '../controllers/partnerPortal.controller.js';
import { authenticate } from '../middleware/auth.js';
import { partnerScanRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../validators/validate.js';
import { partnerRedeemCodeSchema } from '../validators/placeClaim.validators.js';

const router = Router();

router.use(authenticate);
router.get('/dashboard', getDashboard);
router.post('/redeem', partnerScanRateLimiter, validateBody(partnerRedeemCodeSchema), redeemVoucherCode);

export default router;
