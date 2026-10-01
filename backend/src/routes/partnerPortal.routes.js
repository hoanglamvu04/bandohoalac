import { Router } from 'express';
import {
  changePartnerStaffStatus,
  createPartnerStaff,
  getDashboard,
  inspectVoucherCode,
  redeemVoucherCode,
  updateManagedPlaceDetails,
  useVoucher
} from '../controllers/partnerPortal.controller.js';
import { authenticate } from '../middleware/auth.js';
import { partnerScanRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../validators/validate.js';
import {
  partnerRedeemCodeSchema,
  partnerStaffCreateSchema,
  partnerStaffStatusSchema,
  partnerUpdatePlaceSchema,
  partnerVoucherInspectSchema,
  partnerVoucherUseSchema
} from '../validators/placeClaim.validators.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboard);

router.post(
  '/vouchers/inspect',
  partnerScanRateLimiter,
  validateBody(partnerVoucherInspectSchema),
  inspectVoucherCode
);

router.post(
  '/vouchers/:id/use',
  partnerScanRateLimiter,
  validateBody(partnerVoucherUseSchema),
  useVoucher
);

// Backward compatibility for older frontend versions.
router.post(
  '/redeem',
  partnerScanRateLimiter,
  validateBody(partnerRedeemCodeSchema),
  redeemVoucherCode
);

router.post(
  '/staff',
  validateBody(partnerStaffCreateSchema),
  createPartnerStaff
);

router.patch(
  '/staff/:id',
  validateBody(partnerStaffStatusSchema),
  changePartnerStaffStatus
);

router.patch(
  '/places/:id',
  validateBody(partnerUpdatePlaceSchema),
  updateManagedPlaceDetails
);

export default router;
