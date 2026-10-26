import { Router } from 'express';
import { register, login, me, refresh, logout } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter, authSessionRateLimiter } from '../middleware/rateLimit.js';
import { requireTrustedBrowserOrigin } from '../middleware/trustedOrigin.js';
import { validateBody } from '../validators/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/refresh', requireTrustedBrowserOrigin, authSessionRateLimiter, refresh);
router.post('/logout', requireTrustedBrowserOrigin, authSessionRateLimiter, logout);
router.get('/me', authenticate, me);

export default router;
