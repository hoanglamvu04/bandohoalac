import { Router } from 'express';
import { create, listMine } from '../controllers/contributions.controller.js';
import { authenticate } from '../middleware/auth.js';
import { contributionRateLimiter } from '../middleware/rateLimit.js';
import { uploadPhotos } from '../middleware/upload.js';
import { parseJsonFields } from '../middleware/parseJsonFields.js';
import { validateBody } from '../validators/validate.js';
import { createContributionSchema } from '../validators/contribution.validators.js';

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

router.get('/me', authenticate, listMine);

export default router;
