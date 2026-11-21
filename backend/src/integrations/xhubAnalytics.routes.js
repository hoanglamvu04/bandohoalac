// WA-002 — site-owned, opt-in-only forwarding. Does not alter the existing API.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createXHubAnalyticsBridge } from './xhub-express-bridge.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ID = /^[1-9][0-9]{0,18}$/;
const ALLOWED_PATHS = new Set(['/', '/map', '/place', '/dia-diem', '/local-map']);
const ALLOWED_NAMES = new Set([
  'page_view', 'search_used', 'filter_used', 'map_place_view',
  'map_directions_click', 'favorite_added', 'contact_click', 'lead_submitted'
]);
const EVENT_KEYS = new Set([
  'eventId', 'sessionId', 'name', 'occurredAt', 'path',
  'consent', 'entityType', 'entityKey'
]);
const ENTITY_EVENTS = new Set([
  'map_place_view', 'map_directions_click', 'favorite_added'
]);

export function validXHubSiteBatch(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['schemaVersion', 'events'].includes(key)) ||
      body.schemaVersion !== 1 || !Array.isArray(body.events) ||
      body.events.length < 1 || body.events.length > 20 ||
      Buffer.byteLength(JSON.stringify(body), 'utf8') > 16000) return false;

  return body.events.every((event) => {
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        Object.keys(event).some((key) => !EVENT_KEYS.has(key)) ||
        !UUID.test(event.eventId || '') || !UUID.test(event.sessionId || '') ||
        !ALLOWED_NAMES.has(event.name) || event.consent !== true ||
        !ALLOWED_PATHS.has(event.path)) return false;

    const timestamp = Date.parse(event.occurredAt);
    if (typeof event.occurredAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.occurredAt) ||
        !Number.isFinite(timestamp) ||
        timestamp < now - 24 * 60 * 60 * 1000 ||
        timestamp > now + 5 * 60 * 1000) return false;

    if (ENTITY_EVENTS.has(event.name)) {
      return (event.path === '/place' || event.path === '/dia-diem' ||
        event.path === '/map' || event.path === '/local-map') &&
        event.entityType === 'place' && PUBLIC_ID.test(event.entityKey || '');
    }
    // No arbitrary labels or identifiers for search, filters, lead, page.
    return event.entityType === undefined && event.entityKey === undefined;
  });
}

export function createXHubAnalyticsRouter({
  enabled = false,
  approved = false,
  siteId,
  siteToken,
  publicHost,
  baseUrl,
  send,
  allowLocalhost = false
} = {}) {
  const router = Router();
  let bridge = null;
  if (enabled === true && approved === true) {
    try {
      bridge = createXHubAnalyticsBridge({
        siteId, siteToken, publicHost, baseUrl, send, allowLocalhost
      });
    } catch {
      // Fail closed if source has not been provisioned. Never log secrets.
    }
  }
  const available = Boolean(bridge);
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Analytics rate limit exceeded.' }
  });

  router.get('/status', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ schemaVersion: 1, enabled: available });
  });

  router.post('/', limiter, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!available) return res.status(503).json({ error: 'Analytics unavailable.' });

    // Same-origin check is stricter than the shared adapter: no alternate
    // ports, schemes or sibling subdomains. No Origin = no browser consent.
    const origin = req.get('Origin');
    const expected = 'https://' + publicHost;
    const localAllowed = allowLocalhost && publicHost === 'localhost' &&
      /^http:\/\/localhost:\d+$/.test(origin || '');
    const fetchSite = req.get('Sec-Fetch-Site');
    if (!(origin === expected || localAllowed) ||
        (fetchSite && !['same-origin', 'none'].includes(fetchSite)) ||
        req.get('Sec-GPC') === '1' || req.get('DNT') === '1') {
      return res.status(403).json({ error: 'Origin or privacy signal not allowed.' });
    }
    if (!req.is('application/json') || !validXHubSiteBatch(req.body)) {
      return res.status(400).json({ error: 'Invalid analytics event batch.' });
    }
    return next();
  }, (req, res) => bridge(req, res));

  return router;
}
