import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../validators/validate.js';
import {
  feedbackSubmitSchema, vitalSampleSchema
} from '../validators/softLaunch.validators.js';
import { submitFeedback, submitVital } from '../controllers/softLaunchV1.controller.js';

const router = Router();

const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đã gửi nhiều phản hồi. Hãy thử lại sau.' }
});

const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many performance samples.' }
});

router.post('/feedback', feedbackLimiter, validateBody(feedbackSubmitSchema), submitFeedback);
router.post('/vitals', telemetryLimiter, validateBody(vitalSampleSchema), submitVital);

export default router;
