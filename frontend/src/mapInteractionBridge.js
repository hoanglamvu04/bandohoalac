import * as maplibre from 'maplibre-gl';
import { isInsideServiceCoverage } from './mapConfig.js';

const PATCH_KEY = '__holaInteractionBridgePatchedV2';
const MAP_KEY = '__HOLA_MAP_INSTANCE__';
const INTERACTIVE_LAYER_IDS = [
  'hm-place-clusters',
  'hm-place-cluster-point-label',
  'hm-place-name-label',
  'hm-road-closure-report-point',
  'hm-flood-report-point',
  'hm-landmark',
  'hm-event',
  'hm-alert'
];

function dispatchPin(map, payload) {
  if (typeof window === 'undefined' || !payload?.lngLat) return;
  const lng = Number(payload.lngLat.lng);
  const lat = Number(payload.lngLat.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  if (!isInsideServiceCoverage(lng, lat)) return;

  const point = payload.point;
  if (point && typeof map?.queryRenderedFeatures === 'function') {
    const layers = INTERACTIVE_LAYER_IDS.filter((id) => map.getLayer?.(id));
    if (layers.length) {
      try {
        const hits = map.queryRenderedFeatures(point, { layers });
        if (hits?.length) return;
      } catch {
        // Style may switch between click and hit testing. A background pin remains safe.
      }
    }
  }

  window.dispatchEvent(new CustomEvent('hola-map-pin', {
    detail: {
      lat,
      lng,
      source: payload.type === 'contextmenu' ? 'long-press' : 'map-click'
    }
  }));
}

if (typeof window !== 'undefined' && !window[PATCH_KEY]) {
  window[PATCH_KEY] = true;
  const originalFire = maplibre.Map.prototype.fire;

  maplibre.Map.prototype.fire = function holaFireBridge(event, properties) {
    const result = originalFire.apply(this, arguments);
    const type = typeof event === 'string' ? event : event?.type;
    const payload = typeof event === 'string' ? { ...(properties || {}), type } : event;

    if (type === 'load' || type === 'style.load' || type === 'moveend') {
      window[MAP_KEY] = this;
    }

    if ((type === 'click' || type === 'contextmenu') && payload?.lngLat) {
      window[MAP_KEY] = this;
      window.setTimeout(() => dispatchPin(this, payload), 0);
    }

    return result;
  };
}

export function getHolaMapInstance() {
  return typeof window === 'undefined' ? null : window[MAP_KEY] || null;
}

export function focusHolaMapPoint({ lat, lng, zoom = 16 }) {
  const map = getHolaMapInstance();
  if (!map || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return false;
  map.flyTo({
    center: [Number(lng), Number(lat)],
    zoom: Math.max(Number(map.getZoom?.()) || 0, Number(zoom) || 16),
    duration: 600,
    essential: true
  });
  return true;
}
