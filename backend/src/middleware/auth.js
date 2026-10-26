import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

async function resolveAuthenticatedUser(token) {
  const payload = verifyToken(token);
  const { rows } = await pool.query(
    `SELECT
       u.id, u.email, u.role, u.account_status,
       u.ctv_level, u.ctv_trust_score, u.ctv_reviews_count,
       u.ctv_confirmed_count, u.ctv_overturned_count,
       s.id AS session_id,
       s.two_factor_verified_at
     FROM users u
     JOIN auth_sessions s
       ON s.user_id = u.id
      AND s.id = $2
     WHERE u.id = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
     LIMIT 1`,
    [payload.id, payload.sid]
  );

  const user = rows[0];
  if (!user) {
    throw new AppError('User account no longer exists.', 401);
  }

  if (user.account_status !== 'ACTIVE') {
    throw new AppError('This account is suspended.', 403);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sessionId: user.session_id,
    twoFactorVerified: Boolean(user.two_factor_verified_at),
    ctvLevel: Number(user.ctv_level || 1),
    ctvTrustScore: Number(user.ctv_trust_score || 0),
    ctvReviewsCount: Number(user.ctv_reviews_count || 0),
    ctvConfirmedCount: Number(user.ctv_confirmed_count || 0),
    ctvOverturnedCount: Number(user.ctv_overturned_count || 0)
  };
}

export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Authentication required.', 401));
  }

  try {
    req.user = await resolveAuthenticatedUser(token);
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('Invalid or expired token.', 401));
  }
}

export async function optionalAuthenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      req.user = await resolveAuthenticatedUser(token);
    } catch {
      req.user = null;
    }
  }

  return next();
}

export function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, _res, next) {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    return next();
  };
}

export async function requireAdminSecurity(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') return next();

  try {
    const { rows } = await pool.query(
      `SELECT two_factor_enabled
       FROM user_security
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows[0]?.two_factor_enabled) {
      return next(new AppError(
        'Quản trị viên phải bật xác thực hai lớp trước khi sử dụng Admin.',
        403,
        { code: 'ADMIN_2FA_SETUP_REQUIRED' }
      ));
    }

    if (!req.user.twoFactorVerified) {
      return next(new AppError(
        'Phiên quản trị này chưa được xác thực hai lớp.',
        403,
        { code: 'ADMIN_2FA_REQUIRED' }
      ));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireCtvLevel(minimumLevel = 1) {
  return function requireCtvLevelMiddleware(req, _res, next) {
    if (!req.user) return next(new AppError('Authentication required.', 401));
    if (req.user.role === 'ADMIN' || req.user.role === 'MODERATOR') return next();
    if (req.user.role !== 'CTV' || Number(req.user.ctvLevel || 1) < Number(minimumLevel)) {
      return next(new AppError('Tác vụ này yêu cầu CTV cấp ' + minimumLevel + ' hoặc cao hơn.', 403));
    }
    return next();
  };
}
