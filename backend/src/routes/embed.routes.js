import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../validators/validate.js';
import { embedRequestLimiter, embedPolicyLimiter } from '../middleware/rateLimit.js';
import {
  checkEmbedAuthorization,
  getMyEmbedRequests,
  submitEmbedRequest
} from '../controllers/embed.controller.js';
import { embedRequestSchema } from '../validators/embed.validators.js';

const router = Router();

// Nginx internal auth_request calls this for EVERY iframe document navigation.
router.get('/authorize', embedPolicyLimiter, checkEmbedAuthorization);

router.get('/requests/mine', authenticate, getMyEmbedRequests);
router.post('/requests', authenticate, embedRequestLimiter, validateBody(embedRequestSchema), submitEmbedRequest);

export default router;
