import {
  getDeveloperApiGatewayConfig,
  matchDeveloperApiEndpoint,
  recordDeveloperApiUsage,
  resolveDeveloperApiKey,
  touchDeveloperApiKey
} from '../services/developerApi.service.js';

const quotaWindows = new Map();

function requestIp(req) {
  return req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.ip || null;
}

function quotaResult(keyId, limit) {
  const minute = 60000;
  const now = Date.now();
  const current = quotaWindows.get(keyId);
  const state = !current || now - current.startedAt >= minute
    ? { startedAt: now, count: 0 }
    : current;
  state.count += 1;
  quotaWindows.set(keyId, state);
  return {
    allowed: state.count <= limit,
    remaining: Math.max(0, limit - state.count),
    resetSeconds: Math.max(1, Math.ceil((state.startedAt + minute - now) / 1000))
  };
}

function sendError(res, status, code, error) {
  return res.status(status).json({ error, code });
}

export async function developerApiGateway(req, res, next) {
  const startedAt = Date.now();
  const endpointKey = matchDeveloperApiEndpoint(req.path, req.method);
  let resolvedKey = null;

  res.on('finish', () => {
    recordDeveloperApiUsage({
      clientId: resolvedKey?.clientId || null,
      keyId: resolvedKey?.keyId || null,
      endpointKey,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      origin: req.headers.origin || null,
      ipAddress: requestIp(req),
      userAgent: req.headers['user-agent'] || null
    }).catch((error) => console.warn('[Developer API] usage log failed:', error.message));
  });

  if (!endpointKey) return next();

  try {
    const { settings, endpoints } = await getDeveloperApiGatewayConfig();
    const endpoint = endpoints.get(endpointKey);
    if (!endpoint?.enabled) {
      return sendError(res, 503, 'ENDPOINT_DISABLED', 'This Developer API endpoint is currently disabled.');
    }

    if (endpointKey === 'openapi' && !settings.docsEnabled) {
      return sendError(res, 404, 'DOCS_DISABLED', 'Developer API documentation is disabled.');
    }

    const docsEndpoint = endpointKey === 'openapi' || endpointKey === 'meta';
    if (!settings.enabled && !docsEndpoint) {
      return sendError(res, 503, 'API_DISABLED', 'Hola Maps Developer API is temporarily unavailable.');
    }

    const rawKey = req.headers['x-hola-api-key'];
    if (rawKey) {
      resolvedKey = await resolveDeveloperApiKey(rawKey);
      if (!resolvedKey) {
        return sendError(res, 401, 'INVALID_API_KEY', 'Invalid or inactive Hola Maps API key.');
      }

      const origin = req.headers.origin;
      if (origin && resolvedKey.allowedOrigins.length && !resolvedKey.allowedOrigins.includes(origin)) {
        return sendError(res, 403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed for the supplied API key.');
      }

      const permissions = resolvedKey.permissions || ['*'];
      if (!permissions.includes('*') && !permissions.includes(endpointKey)) {
        return sendError(res, 403, 'ENDPOINT_NOT_ALLOWED', 'This API key cannot access this endpoint.');
      }

      const limit = Math.min(Math.max(resolvedKey.rateLimitPerMinute || 300, 30), 600);
      const quota = quotaResult(resolvedKey.keyId, limit);
      res.set('X-Hola-Client', resolvedKey.clientSlug);
      res.set('X-Hola-RateLimit-Limit', String(limit));
      res.set('X-Hola-RateLimit-Remaining', String(quota.remaining));
      res.set('X-Hola-RateLimit-Reset', String(quota.resetSeconds));
      if (!quota.allowed) {
        return sendError(res, 429, 'CLIENT_RATE_LIMIT', 'This API client has exceeded its per-minute quota.');
      }

      touchDeveloperApiKey(resolvedKey.keyId).catch(() => {});
      req.developerApiClient = resolvedKey;
    } else if (!docsEndpoint && (settings.accessMode === 'PARTNER' || endpoint.requiresKey)) {
      return sendError(res, 401, 'API_KEY_REQUIRED', 'X-Hola-API-Key is required for this endpoint.');
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
