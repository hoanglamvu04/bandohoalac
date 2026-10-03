import { env } from './env.js';
import { getDeveloperApiAllowedOrigins } from '../services/developerApi.service.js';

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

function resolveAgainst(origin, allowedOrigins, callback) {
  if (!origin) return callback(null, true);

  if (env.nodeEnv !== 'production' && LOCALHOST_ORIGIN.test(origin)) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS: origin "${origin}" is not allowed.`));
}

export function resolveCorsOrigin(origin, callback) {
  return resolveAgainst(origin, env.corsOrigin, callback);
}

export function resolvePublicApiCorsOrigin(origin, callback) {
  if (!origin) return callback(null, true);

  if (env.nodeEnv !== 'production' && LOCALHOST_ORIGIN.test(origin)) {
    return callback(null, true);
  }

  const staticAllowed = Array.from(new Set([
    ...env.corsOrigin,
    ...env.publicApiCorsOrigin
  ]));
  if (staticAllowed.includes(origin)) return callback(null, true);

  getDeveloperApiAllowedOrigins()
    .then((dynamicAllowed) => {
      if (dynamicAllowed.includes(origin)) return callback(null, true);
      return callback(new Error('CORS: origin "' + origin + '" is not allowed.'));
    })
    .catch((error) => callback(error));
}
