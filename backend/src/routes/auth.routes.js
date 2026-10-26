import { Router } from 'express';
import { register, login, me, refresh, logout } from '../controllers/auth.controller.js';
import {
  confirmTwoFactor,
  removeTwoFactor,
  revokeAllSecuritySessions,
  revokeSecuritySession,
  securityOverview,
  startTwoFactorSetup
} from '../controllers/authSecurity.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter, authSessionRateLimiter, securityActionRateLimiter } from '../middleware/rateLimit.js';
import { requireTrustedBrowserOrigin } from '../middleware/trustedOrigin.js';
import { validateBody } from '../validators/validate.js';
import {
  registerSchema,
  loginSchema,
  twoFactorSetupSchema,
  twoFactorConfirmSchema,
  twoFactorDisableSchema
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/refresh', requireTrustedBrowserOrigin, authSessionRateLimiter, refresh);
router.post('/logout', requireTrustedBrowserOrigin, authSessionRateLimiter, logout);
router.get('/me', authenticate, me);
router.get('/security', authenticate, securityOverview);
router.post('/security/2fa/setup', authenticate, securityActionRateLimiter, validateBody(twoFactorSetupSchema), startTwoFactorSetup);
router.post('/security/2fa/confirm', authenticate, securityActionRateLimiter, validateBody(twoFactorConfirmSchema), confirmTwoFactor);
router.delete('/security/2fa', authenticate, securityActionRateLimiter, validateBody(twoFactorDisableSchema), removeTwoFactor);
router.delete('/security/sessions/:sessionId', authenticate, securityActionRateLimiter, revokeSecuritySession);
router.post('/security/sessions/revoke-all', authenticate, securityActionRateLimiter, revokeAllSecuritySessions);

export default router;
