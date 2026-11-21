// WA-002 — privacy-preserving HOLA Maps adapter for the copied X-HUB SDK.
// No account information, raw query, GPS, phone, form fields or persistent IDs.
import { createXHubWebTracker } from './xhub-web-tracker.mjs';

export const XHUB_CONSENT_KEY = 'hola_xhub_analytics_consent_v1';
const PUBLIC_PLACE_ID = /^[1-9][0-9]{0,18}$/;
const PUBLIC_ROUTES = new Map([['/', '/'], ['/map', '/map']]);

let sdk = null;
let bridgeState = 'unknown';
let readinessPromise = null;
let lastRouteView = null;

function browser() {
  return typeof window === 'undefined' ? null : window;
}

export function isXHubPrivacyBlocked(root = browser()) {
  return !root || root.navigator?.globalPrivacyControl === true ||
    root.navigator?.doNotTrack === '1' ||
    root.navigator?.msDoNotTrack === '1';
}

export function getXHubConsent(root = browser()) {
  if (!root) return 'unset';
  try {
    const value = root.localStorage?.getItem(XHUB_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : 'unset';
  } catch {
    // An unavailable storage never means implicit consent.
    return 'unset';
  }
}

function consentActive() {
  const root = browser();
  return getXHubConsent(root) === 'granted' && !isXHubPrivacyBlocked(root);
}

export function publicAnalyticsPath(pathname) {
  if (PUBLIC_ROUTES.has(pathname)) return PUBLIC_ROUTES.get(pathname);
  if (/^\/place\/[1-9][0-9]{0,18}\/?$/.test(pathname || '')) return '/place';
  if (/^\/dia-diem\/[a-zA-Z0-9_-]{1,120}\/?$/.test(pathname || '')) return '/dia-diem';
  if (/^\/local-map\/[a-zA-Z0-9_-]{1,120}\/?$/.test(pathname || '')) return '/local-map';
  return null;
}

export function publicPlaceKey(value) {
  const key = String(value ?? '');
  return PUBLIC_PLACE_ID.test(key) ? key : null;
}

function tracker() {
  const root = browser();
  if (!root) return null;
  if (!sdk) {
    // Copy of WA-001 reads only these restricted fields, never raw location.
    // All route IDs are replaced with coarse public path names; all UTM and
    // referrer data are removed to avoid accidental PII in marketing tags.
    const safeRoot = {
      get crypto() { return root.crypto; },
      get navigator() { return root.navigator; },
      location: {
        get pathname() { return publicAnalyticsPath(root.location.pathname) || ''; },
        search: ''
      },
      document: { referrer: '' },
      fetch: root.fetch.bind(root)
    };
    sdk = createXHubWebTracker({
      endpoint: '/api/xhub-analytics',
      root: safeRoot,
      hasConsent: () => consentActive() && bridgeState === 'enabled'
    });
  }
  return sdk;
}

export function disableXHubTracking() {
  sdk?.disable();
  sdk = null; // A new consent grants a fresh in-memory anonymous session.
  lastRouteView = null;
  bridgeState = 'unknown';
  readinessPromise = null;
}

export function setXHubConsent(choice) {
  if (choice !== 'granted' && choice !== 'denied') return false;
  const root = browser();
  if (!root || (choice === 'granted' && isXHubPrivacyBlocked(root))) return false;
  try {
    root.localStorage?.setItem(XHUB_CONSENT_KEY, choice);
  } catch {
    // Without explicit durable opt-in, do not collect.
    disableXHubTracking();
    return false;
  }
  disableXHubTracking();
  return true;
}

export async function xhubBridgeAvailable() {
  if (!consentActive()) {
    disableXHubTracking();
    return false;
  }
  if (bridgeState === 'enabled') return true;
  if (bridgeState === 'disabled') return false;
  if (readinessPromise) return readinessPromise;

  const root = browser();
  readinessPromise = (async () => {
    try {
      const response = await root.fetch('/api/xhub-analytics/status', {
        method: 'GET', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const payload = response.ok ? await response.json() : null;
      if (!consentActive()) return false;
      bridgeState = payload?.enabled === true && payload?.schemaVersion === 1
        ? 'enabled' : 'disabled';
      return bridgeState === 'enabled';
    } catch {
      if (consentActive()) bridgeState = 'disabled';
      return false;
    } finally {
      readinessPromise = null;
    }
  })();
  return readinessPromise;
}

export async function trackXHubEvent(name, { entityType, entityKey } = {}) {
  if (!consentActive() || !publicAnalyticsPath(browser()?.location?.pathname)) return false;
  if (!(await xhubBridgeAvailable()) || !consentActive()) return false;
  if (entityType !== undefined) {
    if (entityType !== 'place' || !publicPlaceKey(entityKey)) return false;
  }
  const instance = tracker();
  const result = instance?.track(name,
    entityType === 'place' ? { entityType, entityKey: String(entityKey) } : {});
  if (result) void instance.flush();
  return Boolean(result);
}

export async function trackXHubRoutePageView(pathname) {
  if (!publicAnalyticsPath(pathname) || !consentActive()) return false;
  if (!(await xhubBridgeAvailable()) || !consentActive()) return false;
  if (browser()?.location.pathname !== pathname || lastRouteView === pathname) return false;
  // Mark before awaiting network work to avoid duplicate page_view when the
  // consent button and React's route effect race on the same navigation.
  lastRouteView = pathname;
  const result = await trackXHubEvent('page_view');
  if (!result && lastRouteView === pathname) lastRouteView = null;
  return result;
}
