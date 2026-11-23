import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { getNearbyPlaces } from './place.service.js';
import { resolveAnchor } from './smartPlaceSearch.service.js';
import { rankDiscoveryItems } from './smartDiscoveryRanking.service.js';

// Public landmarks only: never use a visitor's browser GPS or route history.
const ANCHORS = Object.freeze({
  fpt: 'FPT',
  dhqg: 'ĐHQG',
  cnc: 'Khu công nghệ cao Hòa Lạc'
});
const ALLOWED_MINUTES = new Set([5, 10, 15]);
const MAX_CANDIDATES = 40;
const CACHE_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 48;

function candidateCoordinates(anchor, places) {
  return [anchor, ...places].map((p) => Number(p.lng) + ',' + Number(p.lat)).join(';');
}

export function createTravelTimeDiscovery({
  resolveLandmark = resolveAnchor,
  listNearby = getNearbyPlaces,
  routingFetch = fetch,
  routingBaseUrl = env.routingBaseUrl,
  timeoutMs = env.routingTimeoutMs,
  clock = () => Date.now()
} = {}) {
  const cache = new Map();
  async function calculate({ anchor, minutes, category, limit }) {
    const query = ANCHORS[anchor];
    const { anchor: location } = await resolveLandmark(query);
    if (!location || !Number.isFinite(Number(location.lat)) ||
        !Number.isFinite(Number(location.lng))) {
      throw new AppError('Chưa tìm thấy mốc địa danh có thể định tuyến.', 404);
    }

    // Cheap PostGIS geographic prefilter; time itself is ALWAYS from an
    // actual OSRM road-network duration matrix, never straight-line math.
    const radius = Math.min(25_000, Math.round(minutes * 60 * 22 + 2_000));
    const nearby = await listNearby({
      lat: Number(location.lat), lng: Number(location.lng),
      radius, category: category || undefined, limit: MAX_CANDIDATES + 1,
      offset: 0, status: 'PUBLISHED'
    });
    const candidates = nearby.filter((item) =>
      item?.status === 'PUBLISHED' &&
      String(item.id) !== String(location.id) &&
      Number.isFinite(Number(item.lat)) &&
      Number.isFinite(Number(item.lng))
    ).slice(0, MAX_CANDIDATES);

    const anchorData = {
      id: location.id,
      name: location.name,
      resultType: location.resultType || 'place',
      lat: Number(location.lat),
      lng: Number(location.lng)
    };
    if (!candidates.length) {
      return {
        items: [], anchor: anchorData,
        minutes, profile: 'driving',
        meta: { provider: 'OSRM', method: 'road-network-duration',
          candidatesChecked: 0, candidateLimit: MAX_CANDIDATES,
          limitedCoverage: false }
      };
    }

    const base = String(routingBaseUrl || '').replace(/\/$/, '');
    const url = new URL(base + '/table/v1/driving/' +
      candidateCoordinates(location, candidates));
    url.searchParams.set('sources', '0');
    url.searchParams.set('annotations', 'duration');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(Number(timeoutMs) || 10_000, 12_000));
    let matrix;
    try {
      const response = await routingFetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'HolaMaps/3.0' }
      });
      if (!response.ok) throw new Error('Unavailable route matrix');
      matrix = await response.json();
    } catch {
      throw new AppError('Chưa tính được thời gian lái xe. Vui lòng thử lại.', 503);
    } finally {
      clearTimeout(timer);
    }
    const durationRow = matrix?.durations?.[0];
    if (matrix?.code !== 'Ok' || !Array.isArray(durationRow) ||
        durationRow.length !== candidates.length + 1) {
      throw new AppError('Dịch vụ thời gian lái xe đang không khả dụng.', 503);
    }
    const eligible = candidates.flatMap((place, index) => {
      const duration = durationRow[index + 1];
      if (duration === null || !Number.isFinite(duration) ||
          duration < 0 || duration > minutes * 60) return [];
      return [{ ...place, durationSeconds: Math.round(duration),
        travelMinutes: Math.round(duration / 6) / 10 }];
    });

    // Organic quality only breaks close travel-time ties; prioritization is
    // by actual route duration first, with no paid position in the listing.
    const ranked = rankDiscoveryItems(eligible, { category });
    const tieOrder = new Map(ranked.map((p, i) => [String(p.id), i]));
    eligible.sort((a, b) => a.durationSeconds - b.durationSeconds ||
      tieOrder.get(String(a.id)) - tieOrder.get(String(b.id)));
    const totalCount = Number(nearby[0]?.totalCount);
    return {
      items: eligible.slice(0, limit),
      anchor: anchorData,
      minutes, profile: 'driving',
      meta: {
        provider: 'OSRM',
        method: 'road-network-duration',
        candidatesChecked: candidates.length,
        candidateLimit: MAX_CANDIDATES,
        limitedCoverage: nearby.length > MAX_CANDIDATES ||
          (Number.isFinite(totalCount) && totalCount > nearby.length)
      }
    };
  }

  async function search({ anchor = 'fpt', minutes = 10, category = null, limit = 12 } = {}) {
    if (!Object.hasOwn(ANCHORS, anchor) || !ALLOWED_MINUTES.has(minutes) ||
        !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new AppError('Tham số khám phá theo thời gian không hợp lệ.', 400);
    }
    const key = [anchor, minutes, category || 'all', limit].join('|');
    const current = clock();
    const previous = cache.get(key);
    if (previous && previous.expiresAt > current) return previous.promise;
    const promise = calculate({ anchor, minutes, category, limit });
    cache.delete(key);
    cache.set(key, { promise, expiresAt: current + CACHE_TTL_MS });
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    try {
      return await promise;
    } catch (error) {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    }
  }
  return { search };
}

export const travelTimeDiscovery = createTravelTimeDiscovery();
