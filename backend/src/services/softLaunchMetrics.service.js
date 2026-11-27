// Anonymous, bounded in-process operational metrics for launch triage.
// Never collect IPs, URLs with IDs/query strings, cookies, bodies or tokens.
const WINDOW_MINUTES = 15;
const MAX_SAMPLES_PER_MINUTE = 64;
const GROUPS = [
  'all', 'auth', 'places', 'housing', 'layers', 'directions',
  'contributions', 'public_api', 'notifications', 'admin', 'other'
];

function routeMatches(path, prefix) {
  return path === prefix || path.startsWith(prefix + '/');
}

export function routeGroup(path) {
  if (!path || !routeMatches(path, '/api')) return null;
  if (routeMatches(path, '/api/auth')) return 'auth';
  if (routeMatches(path, '/api/places')) return 'places';
  if (routeMatches(path, '/api/housing')) return 'housing';
  if (routeMatches(path, '/api/map-layers')) return 'layers';
  if (routeMatches(path, '/api/directions')) return 'directions';
  if (routeMatches(path, '/api/contributions')) return 'contributions';
  if (routeMatches(path, '/api/public/v1')) return 'public_api';
  if (routeMatches(path, '/api/notifications')) return 'notifications';
  if (routeMatches(path, '/api/admin')) return 'admin';
  return 'other';
}

export function createSoftLaunchMetrics({
  now = () => Date.now(),
  random = Math.random,
  windowMinutes = WINDOW_MINUTES,
  maxSamplesPerMinute = MAX_SAMPLES_PER_MINUTE
} = {}) {
  const startedAt = new Date(now()).toISOString();
  // Fixed cardinality: only 11 predefined groups, 15 time slots and at most
  // 64 samples per group per slot, even during a traffic spike.
  const stores = new Map(GROUPS.map((key) => [key, Array(windowMinutes).fill(null)]));

  function record({ path, statusCode, durationMs, searchRequest = false }) {
    const group = routeGroup(path);
    if (!group) return;
    const epochMinute = Math.floor(now() / 60_000);
    const status = Number(statusCode);
    const duration = Math.max(0, Math.min(300_000, Number(durationMs) || 0));

    for (const key of ['all', group]) {
      const slots = stores.get(key);
      const slotIndex = ((epochMinute % windowMinutes) + windowMinutes) % windowMinutes;
      let bucket = slots[slotIndex];
      if (!bucket || bucket.minute !== epochMinute) {
        bucket = {
          minute: epochMinute, requests: 0, searchRequests: 0, successfulSearchRequests: 0, clientErrors: 0,
          serverErrors: 0, rateLimited: 0, aborted: 0,
          slow: 0, samples: []
        };
        slots[slotIndex] = bucket;
      }

      bucket.requests += 1;
      if (searchRequest === true && ['places', 'housing'].includes(group)) {
        bucket.searchRequests += 1;
        if (status >= 200 && status < 300) bucket.successfulSearchRequests += 1;
      }
      if (status >= 400 && status < 500) bucket.clientErrors += 1;
      if (status >= 500 && status <= 599) bucket.serverErrors += 1;
      if (status === 429) bucket.rateLimited += 1;
      if (status === 499) bucket.aborted += 1;
      if (duration > 1500) bucket.slow += 1;

      // Reservoir sampling prevents high-traffic minutes being represented
      // solely by the first requests, while enforcing a strict memory cap.
      if (bucket.samples.length < maxSamplesPerMinute) {
        bucket.samples.push(duration);
      } else {
        const index = Math.floor(random() * bucket.requests);
        if (index < maxSamplesPerMinute) bucket.samples[index] = duration;
      }
    }
  }

  function snapshotGroup(key, currentMinute) {
    const combined = {
      group: key, requests: 0, searchRequests: 0, successfulSearchRequests: 0, clientErrors: 0, serverErrors: 0,
      rateLimited: 0, aborted: 0, slow: 0, sampledRequests: 0,
      p95Ms: null, errorRatePct: 0
    };
    const samples = [];
    for (const bucket of stores.get(key)) {
      if (!bucket || bucket.minute > currentMinute ||
          bucket.minute <= currentMinute - windowMinutes) continue;
      combined.requests += bucket.requests;
      combined.searchRequests += bucket.searchRequests;
      combined.successfulSearchRequests += bucket.successfulSearchRequests;
      combined.clientErrors += bucket.clientErrors;
      combined.serverErrors += bucket.serverErrors;
      combined.rateLimited += bucket.rateLimited;
      combined.aborted += bucket.aborted;
      combined.slow += bucket.slow;
      samples.push(...bucket.samples);
    }
    if (samples.length) {
      samples.sort((a, b) => a - b);
      combined.sampledRequests = samples.length;
      combined.p95Ms = Math.round(samples[Math.ceil(0.95 * samples.length) - 1]);
    }
    if (combined.requests) {
      combined.errorRatePct = Math.round(10000 * combined.serverErrors / combined.requests) / 100;
    }
    return combined;
  }

  function snapshot() {
    const currentMinute = Math.floor(now() / 60_000);
    const total = snapshotGroup('all', currentMinute);
    return {
      since: startedAt,
      generatedAt: new Date(now()).toISOString(),
      windowMinutes,
      scope: 'single_process_volatile',
      privacy: 'aggregate_route_groups_only',
      total,
      groups: GROUPS.filter((key) => key !== 'all')
        .map((key) => snapshotGroup(key, currentMinute))
        .filter((row) => row.requests > 0)
    };
  }

  return { record, snapshot };
}

export const softLaunchMetrics = createSoftLaunchMetrics();

export function observeApiRequests(req, res, next) {
  const path = req.path;
  if (routeGroup(path) === null) return next();
  // Count request types only; never keep or return the search term.
  const searchRequest = req.method === 'GET' && ['/api/places', '/api/places/bounds', '/api/housing'].includes(path) && typeof req.query?.q === 'string' && req.query.q.trim().length > 0;
  const started = process.hrtime.bigint();
  let recorded = false;

  function finish(statusCode) {
    if (recorded) return;
    recorded = true;
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    softLaunchMetrics.record({ path, statusCode, durationMs, searchRequest });
  }

  res.once('finish', () => finish(res.statusCode));
  res.once('close', () => {
    if (!res.writableEnded) finish(499);
  });
  next();
}
