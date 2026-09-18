import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Authentication required.', 401));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch {
    return next(new AppError('Invalid or expired token.', 401));
  }
}

export function optionalAuthenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.id, email: payload.email, role: payload.role };
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
