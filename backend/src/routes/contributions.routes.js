import { Router } from 'express';
import {
  create,
  getMyReputation,
  listMine,
  verificationQueue,
  verify
} from '../controllers/contributions.controller.js';
import { confirm as confirmRoadStatus } from '../controllers/roadStatus.controller.js';
import { authenticate } from '../middleware/auth.js';
import { contributionRateLimiter } from '../middleware/rateLimit.js';
import { uploadPhotos } from '../middleware/upload.js';
import { parseJsonFields } from '../middleware/parseJsonFields.js';
import { validateBody } from '../validators/validate.js';
import {
  communityVerificationSchema,
  createContributionSchema
} from '../validators/contribution.validators.js';
import { roadStatusConfirmationSchema } from '../validators/roadStatus.validators.js';

const router = Router();

router.post(
  '/',
  authenticate,
  contributionRateLimiter,
  uploadPhotos,
  parseJsonFields('location', 'place'),
  validateBody(createContributionSchema),
  create
);

router.get('/reputation/me', authenticate, getMyReputation);
router.get('/verification/queue', authenticate, verificationQueue);

router.post(
  '/:id/verification',
  authenticate,
  contributionRateLimiter,
  validateBody(communityVerificationSchema),
  verify
);

router.post(
  '/:id/status-confirmation',
  authenticate,
  contributionRateLimiter,
  validateBody(roadStatusConfirmationSchema),
  confirmRoadStatus
);

router.get('/me', authenticate, listMine);

export default router;
