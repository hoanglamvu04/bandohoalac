import { Router } from 'express';
import { register, login, me, refresh, logout } from '../controllers/auth.controller.js';
import {
  changePassword,
  confirmTwoFactor,
  removeTwoFactor,
  regenerateTwoFactorRecoveryCodes,
  revokeAllSecuritySessions,
  revokeSecuritySession,
  securityOverview,
  startTwoFactorSetup
} from '../controllers/authSecurity.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { authRateLimiter, authSessionRateLimiter, securityActionRateLimiter } from '../middleware/rateLimit.js';
import { requireTrustedBrowserOrigin } from '../middleware/trustedOrigin.js';
import { validateBody } from '../validators/validate.js';
import {
  registerSchema,
  changePasswordSchema,
  loginSchema,
  twoFactorSetupSchema,
  twoFactorConfirmSchema,
  twoFactorDisableSchema,
  twoFactorRecoveryRegenerateSchema
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', requireTrustedBrowserOrigin, authRateLimiter, validateBody(registerSchema), register);
router.post('/login', requireTrustedBrowserOrigin, authRateLimiter, validateBody(loginSchema), login);
router.post('/refresh', requireTrustedBrowserOrigin, authSessionRateLimiter, refresh);
router.post('/logout', requireTrustedBrowserOrigin, authSessionRateLimiter, optionalAuthenticate, logout);
router.get('/me', authenticate, me);
router.get('/security', authenticate, securityOverview);
router.post('/security/password', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, validateBody(changePasswordSchema), changePassword);
router.post('/security/2fa/setup', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, validateBody(twoFactorSetupSchema), startTwoFactorSetup);
router.post('/security/2fa/confirm', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, validateBody(twoFactorConfirmSchema), confirmTwoFactor);
router.post('/security/2fa/recovery-codes', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, validateBody(twoFactorRecoveryRegenerateSchema), regenerateTwoFactorRecoveryCodes);
router.delete('/security/2fa', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, validateBody(twoFactorDisableSchema), removeTwoFactor);
router.delete('/security/sessions/:sessionId', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, revokeSecuritySession);
router.post('/security/sessions/revoke-all', requireTrustedBrowserOrigin, authenticate, securityActionRateLimiter, revokeAllSecuritySessions);

export default router;
