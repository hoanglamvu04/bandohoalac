import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../validators/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.get('/me', authenticate, me);

export default router;
