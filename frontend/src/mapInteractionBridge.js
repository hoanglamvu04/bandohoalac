import * as maplibre from 'maplibre-gl';
import { isInsideServiceCoverage } from './mapConfig.js';

const PATCH_KEY = '__holaInteractionBridgePatchedV4';
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

const FEATURE_NAME_KEYS = [
  'name:vi',
  'name_vi',
  'name',
  'name:latin',
  'name_en',
  'ref'
];

function cleanFeatureName(feature) {
  const properties = feature?.properties || {};
  for (const key of FEATURE_NAME_KEYS) {
    const value = String(properties[key] || '').replace(/\s+/g, ' ').trim();
    if (!value) continue;
    if (value.length > 120) continue;
    if (/^\d+(?:\.\d+)?$/.test(value)) continue;
    return value;
  }
  return '';
}

function featureDescriptor(feature, name) {
  const properties = feature?.properties || {};
  const layer = feature?.layer || {};
  const sourceLayer = String(feature?.sourceLayer || layer['source-layer'] || '');
  const layerId = String(layer.id || '');
  const kind = String(
    properties.kind || properties.kind_detail || properties.type || properties.class || properties.place || ''
  );
  return (sourceLayer + ' ' + layerId + ' ' + kind + ' ' + name).toLowerCase();
}

function isLocalityFeature(feature, name = '') {
  return /\b(place|locality|village|town|hamlet|neighbour|neighborhood|suburb|quarter|district|ward)\b/i
    .test(featureDescriptor(feature, name));
}

function featureSubtitle(feature, name) {
  const descriptor = featureDescriptor(feature, name);
  if (/\b(hồ|lake|water|reservoir|river|stream|canal|pond|wetland|physical)\b/i.test(descriptor)) {
    return 'Hồ / mặt nước trên HOLA Maps';
  }
  if (/\b(road|street|highway|motorway|trunk|primary|secondary|tertiary|đường)\b/i.test(descriptor)) {
    return 'Đường trên HOLA Maps';
  }
  if (/\b(poi|landmark|amenity|shop|tourism|school|hospital|restaurant|cafe)\b/i.test(descriptor)) {
    return 'Địa điểm trên HOLA Maps';
  }
  if (isLocalityFeature(feature, name)) {
    return 'Khu vực trên HOLA Maps';
  }
  return 'Địa danh trên HOLA Maps';
}

function featureScore(feature, name, nearby = false, index = 0) {
  const descriptor = featureDescriptor(feature, name);
  const layerType = String(feature?.layer?.type || '');
  let score = nearby ? 42 : 0;

  if (layerType === 'symbol') score -= 24;
  if (String(feature?.source || '') === 'protomaps') score -= 8;

  if (/\b(hồ|lake|water|reservoir|river|stream|canal|pond|wetland)\b/i.test(descriptor)) {
    score -= 42;
  } else if (isLocalityFeature(feature, name) || /\bphysical\b/i.test(descriptor)) {
    score -= 28;
  } else if (/\b(poi|landmark|amenity|tourism)\b/i.test(descriptor)) {
    score -= 22;
  } else if (/\b(road|street|highway|motorway|trunk|primary|secondary|tertiary|đường)\b/i.test(descriptor)) {
    score -= 12;
  } else if (/\b(building|landuse|boundary)\b/i.test(descriptor)) {
    score += 8;
  }

  if (/^hồ\s/i.test(name)) score -= 18;
  if (/^(sông|suối|đập|kênh)\s/i.test(name)) score -= 12;
  return score + index * 0.01;
}

function collectNamedFeatures(map, point) {
  if (!point || typeof map?.queryRenderedFeatures !== 'function') return [];

  const candidates = [];
  const seen = new Set();
  const add = (features, nearby) => {
    (features || []).forEach((feature, index) => {
      const name = cleanFeatureName(feature);
      if (!name) return;
      const key = [feature?.source || '', feature?.sourceLayer || '', feature?.layer?.id || '', feature?.id || '', name].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({
        feature,
        name,
        score: featureScore(feature, name, nearby, index)
      });
    });
  };

  try {
    add(map.queryRenderedFeatures(point), false);
  } catch {
    // A style switch can briefly make hit testing unavailable.
  }

  try {
    const radiusX = 88;
    const radiusY = 58;
    const box = [
      [point.x - radiusX, point.y - radiusY],
      [point.x + radiusX, point.y + radiusY]
    ];
    add(map.queryRenderedFeatures(box), true);
  } catch {
    // Keep the exact-point result when the nearby query is unavailable.
  }

  return candidates.sort((left, right) => left.score - right.score);
}

function geometryScreenDistance(map, feature, point) {
  const geometry = feature?.geometry;
  if (!geometry || typeof map?.project !== 'function') return Number.POSITIVE_INFINITY;

  let coordinate = null;
  if (geometry.type === 'Point') coordinate = geometry.coordinates;
  else if (geometry.type === 'MultiPoint') coordinate = geometry.coordinates?.[0];

  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  try {
    const projected = map.project(coordinate);
    const dx = Number(projected.x) - Number(point.x);
    const dy = Number(projected.y) - Number(point.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return Number.POSITIVE_INFINITY;
    return Math.sqrt(dx * dx + dy * dy);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function resolveNearestLocality(map, point) {
  if (!point || typeof map?.queryRenderedFeatures !== 'function') return null;

  // Locality labels are intentionally sparse at this zoom. Search a wider screen
  // area so a pin inside Kim Quan can still resolve to the visible "Kim Quan"
  // label even when the user did not click directly on the text.
  const radiusX = 520;
  const radiusY = 340;
  const box = [
    [point.x - radiusX, point.y - radiusY],
    [point.x + radiusX, point.y + radiusY]
  ];

  let features = [];
  try {
    features = map.queryRenderedFeatures(box) || [];
  } catch {
    return null;
  }

  const seen = new Set();
  const candidates = [];

  features.forEach((feature, index) => {
    const name = cleanFeatureName(feature);
    if (!name || !isLocalityFeature(feature, name)) return;

    const key = [feature?.source || '', feature?.sourceLayer || '', feature?.layer?.id || '', feature?.id || '', name].join('|');
    if (seen.has(key)) return;
    seen.add(key);

    const distance = geometryScreenDistance(map, feature, point);
    candidates.push({ feature, name, distance, index });
  });

  if (!candidates.length) return null;

  candidates.sort((left, right) => {
    const leftDistance = Number.isFinite(left.distance) ? left.distance : 99999;
    const rightDistance = Number.isFinite(right.distance) ? right.distance : 99999;
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return left.index - right.index;
  });

  const best = candidates[0];
  return {
    title: best.name,
    subtitle: 'Khu vực trên HOLA Maps'
  };
}

function resolvePinnedMapFeature(map, point) {
  const named = collectNamedFeatures(map, point);
  const best = named[0];

  if (best) {
    const descriptor = featureDescriptor(best.feature, best.name);
    const isSpecificFeature =
      /\b(hồ|lake|water|reservoir|river|stream|canal|pond|wetland|road|street|highway|motorway|trunk|primary|secondary|tertiary|đường|poi|landmark|amenity|shop|tourism|school|hospital|restaurant|cafe)\b/i
        .test(descriptor) || /^hồ\s/i.test(best.name);

    if (isSpecificFeature || isLocalityFeature(best.feature, best.name)) {
      return {
        title: best.name,
        subtitle: featureSubtitle(best.feature, best.name)
      };
    }
  }

  return resolveNearestLocality(map, point);
}

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

  const resolved = point ? resolvePinnedMapFeature(map, point) : null;

  window.dispatchEvent(new CustomEvent('hola-map-pin', {
    detail: {
      lat,
      lng,
      ...(resolved || {}),
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
