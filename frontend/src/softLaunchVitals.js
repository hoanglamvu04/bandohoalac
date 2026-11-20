// Privacy-preserving, best-effort browser performance diagnostics for soft launch.
// No cookies, IDs, full URLs, query strings, coordinates or event targets sent.
// LCP/CLS/INP below are browser-observer approximations (not official CrUX).
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5003/api').replace(/\/$/, '');
const NETWORKS = new Set(['slow-2g', '2g', '3g', '4g']);
const metricsSent = new Set();

export function softLaunchRouteGroup(pathname) {
  const path = String(pathname || '');
  if (path === '/') return 'HOME';
  if (path === '/map' || path.startsWith('/local-map/') ||
      path === '/halo' || path.startsWith('/embed')) return 'MAP';
  if (path.startsWith('/dia-diem/') || path.startsWith('/place/')) return 'PLACE';
  if (path.includes('bat-dong-san') || path === '/phong-tro') return 'HOUSING';
  if (path.startsWith('/kham-pha')) return 'EXPLORE';
  return 'OTHER';
}

function sendVital(metric, value, routeGroup) {
  try {
    if (localStorage.getItem('hola_vitals_opt_out') === '1') return;
  } catch {
    // Do not persist a fallback tracking identifier.
  }
  if (metricsSent.has(metric) || !Number.isFinite(value) || value < 0) return;
  metricsSent.add(metric);
  const payload = JSON.stringify({
    metric,
    routeGroup,
    device: window.matchMedia('(max-width: 767px)').matches ? 'MOBILE' : 'DESKTOP',
    network: NETWORKS.has(navigator.connection?.effectiveType)
      ? navigator.connection.effectiveType
      : 'unknown',
    value: Math.round(value * 100) / 100
  });
  const endpoint = API_URL + '/soft-launch/vitals';

  try {
    // sendBeacon may include same-origin cookies. Fetch with keepalive and
    // credentials:'omit' sends no session cookies or Authorization headers.
    void fetch(endpoint, { method: 'POST', credentials: 'omit',
      keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: payload }).catch(() => {});
  } catch {
    // Telemetry must not interrupt navigation or user interactions.
  }
}

export function registerSoftLaunchVitals() {
  if (!import.meta.env.PROD || typeof window === 'undefined' ||
      typeof PerformanceObserver === 'undefined' ||
      navigator.globalPrivacyControl === true ||
      navigator.doNotTrack === '1') return;

  try {
    if (localStorage.getItem('hola_vitals_opt_out') === '1') return;
  } catch {
    // Private browsing may disable localStorage; no cookie-based fallback.
  }

  const routeGroup = softLaunchRouteGroup(window.location.pathname);
  const supported = new Set(PerformanceObserver.supportedEntryTypes || []);
  const observers = [];
  let lcpValue = null;
  let clsValue = 0;
  let clsSession = 0;
  let clsStart = 0;
  let clsLast = 0;
  const interactions = new Map();

  function observe(type, callback, options = {}) {
    if (!supported.has(type)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) callback(entry);
      });
      observer.observe({ type, buffered: true, ...options });
      observers.push(observer);
    } catch {
      // Unsupported/disabled performance API; skip this metric.
    }
  }

  observe('largest-contentful-paint', (entry) => {
    lcpValue = entry.startTime;
  });

  observe('layout-shift', (entry) => {
    if (entry.hadRecentInput) return;
    if (!clsStart || entry.startTime - clsLast > 1000 ||
        entry.startTime - clsStart > 5000) {
      clsStart = entry.startTime;
      clsSession = 0;
    }
    clsSession += entry.value;
    clsLast = entry.startTime;
    clsValue = Math.max(clsValue, clsSession);
  });

  observe('event', (entry) => {
    if (!entry.interactionId) return;
    const previous = interactions.get(entry.interactionId) || 0;
    interactions.set(entry.interactionId, Math.max(previous, entry.duration));
    // Memory safety in sessions with thousands of interactions.
    if (interactions.size > 1000) interactions.delete(interactions.keys().next().value);
  }, { durationThreshold: 16 });

  const onMapStyleReady = (event) => {
    const ms = Number(event?.detail?.durationMs);
    if (Number.isFinite(ms) && ms >= 0 && ms < 120000) {
      sendVital('MAP_READY', ms, 'MAP');
    }
  };
  window.addEventListener('hola:map-style-ready', onMapStyleReady);

  let finished = false;
  function flush() {
    if (finished) return;
    finished = true;
    // Delivery is best effort on page hide. No identifier is persisted for retries.
    if (lcpValue !== null) sendVital('LCP', lcpValue, routeGroup);
    if (supported.has('layout-shift')) sendVital('CLS', clsValue, routeGroup);
    if (interactions.size) {
      const sorted = Array.from(interactions.values()).sort((a,b) => a - b);
      // Conservative tail estimate; interactionId aggregation avoids double counting.
      const index = Math.max(0, Math.ceil(sorted.length * 0.98) - 1);
      sendVital('INP', sorted[index], routeGroup);
    }
    observers.forEach((observer) => observer.disconnect());
    // Keep the low-cost one-time MAP_READY listener for SPA navigation
    // from Home to Map even if the initial page metrics have flushed.
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  }, { once: false });
  window.addEventListener('pagehide', flush, { once: true });
  window.setTimeout(flush, 30000);
}
