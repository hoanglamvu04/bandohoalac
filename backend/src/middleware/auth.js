import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

async function resolveAuthenticatedUser(token) {
  const payload = verifyToken(token);
  const { rows } = await pool.query(
    `SELECT id, email, role, account_status,
            ctv_level, ctv_trust_score, ctv_reviews_count,
            ctv_confirmed_count, ctv_overturned_count
     FROM users
     WHERE id = $1`,
    [payload.id]
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
