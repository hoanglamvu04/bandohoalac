import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { signAccessToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  getPartnerAccessSummary,
  toPublicUser
} from '../services/user.service.js';
import { getUserReputation } from '../services/reputation.service.js';
import {
  clearFailedLogins,
  clearRefreshCookie,
  createRefreshSession,
  getLoginState,
  getRefreshCookieName,
  readCookie,
  recordFailedLogin,
  recordSecurityEvent,
  revokeRefreshToken,
  revokeSession,
  rotateRefreshSession,
  setRefreshCookie
} from '../services/authSession.service.js';
import {
  getAuthSecuritySummary,
  getEnabledTotpSecret
} from '../services/userSecurity.service.js';
import { verifyTotp } from '../services/totp.service.js';

function requestContext(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null
  };
}

async function toAuthenticatedUser(user) {
  const [partnerAccess, reputation, security] = await Promise.all([
    getPartnerAccessSummary(user.id),
    getUserReputation(user.id),
    getAuthSecuritySummary(user)
  ]);

  return {
    ...toPublicUser(user, reputation),
    partnerAccess,
    security
  };
}

async function issueSession(req, res, user, {
  twoFactorVerified = false
} = {}) {
  const context = requestContext(req);
  const session = await createRefreshSession({
    userId: user.id,
    twoFactorVerified,
    ...context
  });

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    sid: session.id
  });

  setRefreshCookie(res, session.refreshToken);

  await recordSecurityEvent({
    userId: user.id,
    sessionId: session.id,
    type: 'LOGIN_SUCCESS',
    ...context,
    metadata: {
      role: user.role,
      twoFactorVerified
    }
  });

  return {
    token,
    user: await toAuthenticatedUser(user)
  };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, passwordHash, role: 'USER' });
  const sessionPayload = await issueSession(req, res, user);

  res.status(201).json(sessionPayload);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, totpCode } = req.body;
  const context = requestContext(req);
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.account_status && user.account_status !== 'ACTIVE') {
    throw new AppError('This account is suspended.', 403);
  }

  const loginState = await getLoginState(user.id);
  if (
    loginState.locked_until &&
    new Date(loginState.locked_until).getTime() > Date.now()
  ) {
    throw new AppError(
      'Tài khoản tạm khóa do có quá nhiều lần đăng nhập sai. Hãy thử lại sau.',
      429,
      { code: 'ACCOUNT_TEMPORARILY_LOCKED', lockedUntil: loginState.locked_until }
    );
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    await recordFailedLogin({ userId: user.id, ...context });
    throw new AppError('Invalid email or password.', 401);
  }

  let twoFactorVerified = false;
  if (user.role === 'ADMIN') {
    const totpSecret = await getEnabledTotpSecret(user.id);

    if (totpSecret) {
      if (!totpCode) {
        throw new AppError(
          'Nhập mã 6 số từ ứng dụng Authenticator.',
          428,
          { code: 'TWO_FACTOR_REQUIRED' }
        );
      }

      if (!verifyTotp(totpSecret, totpCode)) {
        await recordFailedLogin({ userId: user.id, ...context });
        await recordSecurityEvent({
          userId: user.id,
          type: 'TWO_FACTOR_LOGIN_FAILED',
          severity: 'WARN',
          ...context
        });
        throw new AppError('Mã xác thực hai lớp không đúng.', 401, {
          code: 'TWO_FACTOR_INVALID'
        });
      }

      twoFactorVerified = true;
    }
  }

  await clearFailedLogins(user.id);
  res.json(await issueSession(req, res, user, { twoFactorVerified }));
});

export const refresh = asyncHandler(async (req, res) => {
  const currentToken = readCookie(req, getRefreshCookieName());
  if (!currentToken) {
    throw new AppError('Không có phiên đăng nhập để làm mới.', 401);
  }

  const rotated = await rotateRefreshSession(currentToken, requestContext(req));
  const user = await findUserById(rotated.session.userId);
  if (!user) {
    clearRefreshCookie(res);
    throw new AppError('User not found.', 401);
  }

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    sid: rotated.session.id
  });

  setRefreshCookie(res, rotated.refreshToken);
  res.json({
    token,
    user: await toAuthenticatedUser(user)
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = readCookie(req, getRefreshCookieName());
  const revoked = await revokeRefreshToken(refreshToken, 'LOGOUT');

  if (req.user?.id && req.user?.sessionId) {
    await revokeSession({
      userId: req.user.id,
      sessionId: req.user.sessionId,
      reason: 'LOGOUT'
    });
  }

  clearRefreshCookie(res);

  const eventUserId = revoked?.user_id || req.user?.id || null;
  const eventSessionId = revoked?.id || req.user?.sessionId || null;
  if (eventUserId) {
    await recordSecurityEvent({
      userId: eventUserId,
      sessionId: eventSessionId,
      type: 'LOGOUT',
      ...requestContext(req)
    });
  }

  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) throw new AppError('User not found.', 404);
  res.json({ user: await toAuthenticatedUser(user) });
});
