// WA-005: X-HUB proactively reads consented aggregates (not raw telemetry).
// The READ key is separate from the WA-002 push bearer token.
import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { wa005ConsentedStore } from '../services/wa005ConsentedAnalytics.service.js';

const READ_KEY_PATTERN = /^[a-fA-F0-9]{64}$/;
const DAYS = new Set(['7', '30', '90']);
const unavailable = { error: 'Consented analytics source unavailable.' };

export function validWa005ReadKey(provided, configured) {
  const expectedValid = typeof configured === 'string' &&
    READ_KEY_PATTERN.test(configured);
  const providedValid = typeof provided === 'string' &&
    READ_KEY_PATTERN.test(provided);

  // Always compare equal-length buffers. Neither a malformed input nor a
  // missing configured secret is ever treated as a valid credential.
  const left = expectedValid ? Buffer.from(configured, 'hex') : Buffer.alloc(32);
  const right = providedValid ? Buffer.from(provided, 'hex') : Buffer.alloc(32);
  return timingSafeEqual(left, right) && expectedValid && providedValid;
}

export function createWa005PullAnalyticsRouter({
  enabled = false,
  readKey,
  store = wa005ConsentedStore
} = {}) {
  const router = Router();
  const configured = enabled === true && typeof readKey === 'string' &&
    READ_KEY_PATTERN.test(readKey);
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many analytics requests.' }
  });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('Pragma', 'no-cache');
    // X-HUB calls this without browser context, Origin or auth cookies.
    // Global CORS must be mounted AFTER this route.
    if (req.get('Origin') !== undefined || req.get('Referer') !== undefined ||
        req.get('Cookie') !== undefined || req.get('Sec-Fetch-Site') !== undefined) {
      return res.status(403).json({ error: 'Browser access forbidden.' });
    }
    if (req.method !== 'GET') {
      res.set('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    return next();
  });

  router.get('/summary', limiter, async (req, res) => {
    if (!configured) return res.status(503).json(unavailable);
    if (!validWa005ReadKey(req.get('X-XHub-Analytics-Key'), readKey)) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const params = Object.keys(req.query || {});
    const days = req.query?.days;
    if (params.length !== 1 || params[0] !== 'days' ||
        typeof days !== 'string' || !DAYS.has(days)) {
      return res.status(400).json({ error: 'days must be 7, 30 or 90.' });
    }

    try {
      const response = await store.readSummary(Number(days));
      return res.status(200).json(response);
    } catch {
      // Missing migration/table, unavailable DB or absent consented source:
      // no fake zeroes and no private database errors in responses or logs.
      return res.status(503).json(unavailable);
    }
  });

  // No unprotected fallback routes on this sensitive API.
  router.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  return { router, configured, ingest: (events) => store.ingest(events) };
}
