import { env } from './env.js';

// Vite (and this server's own port-fallback) can land the frontend on
// 5173, 5174, 5175, ... depending on what else is running locally, so
// hard-coding a single dev origin would randomly break CORS. In anything
// but production, accept any localhost/127.0.0.1 origin regardless of
// port; production still enforces the explicit CORS_ORIGIN allowlist.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

export function resolveCorsOrigin(origin, callback) {
  // No Origin header (curl, server-to-server, same-origin) - allow.
  if (!origin) return callback(null, true);

  if (env.nodeEnv !== 'production' && LOCALHOST_ORIGIN.test(origin)) {
    return callback(null, true);
  }

  if (env.corsOrigin.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS: origin "${origin}" is not allowed.`));
}
