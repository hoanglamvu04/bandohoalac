import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function allowedOrigins() {
  const values = new Set(env.corsOrigin || []);

  for (const value of [env.publicBaseUrl, env.holaMapsWebUrl]) {
    if (!value) continue;
    try {
      values.add(new URL(value).origin);
    } catch {
      // Ignore malformed optional URLs; env validation handles required values.
    }
  }

  return values;
}

export function requireTrustedBrowserOrigin(req, _res, next) {
  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    return next(new AppError('Cross-site request blocked.', 403));
  }

  const origin = req.get('origin');
  if (origin && !allowedOrigins().has(origin)) {
    return next(new AppError('Request origin is not trusted.', 403));
  }

  return next();
}
