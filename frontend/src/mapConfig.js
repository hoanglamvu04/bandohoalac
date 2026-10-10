const env = import.meta.env;

export const DEFAULT_CENTER = [105.515, 21.025];
export const DEFAULT_ZOOM = 12.8;
export const MIN_ZOOM = 11.9;
export const MAX_ZOOM = 18;

/**
 * Product service coverage for Hola Maps.
 *
 * The active product area is intentionally limited to the nine communes the
 * project currently serves: Yên Xuân, Hòa Lạc, Yên Bài, Đoài Phương,
 * Thạch Thất, Hạ Bằng, Tây Phương, Kiều Phú and Phú Cát.
 *
 * This is a tight product-coverage polygon, not a legal cadastral boundary.
 * When authoritative commune GeoJSON is available we only need to replace
 * SERVICE_AREA_RING; the frontend/backend filters already consume this shape.
 */
export const SERVICE_AREA_RING = [
  [105.335, 21.145],
  [105.310, 21.100],
  [105.310, 21.035],
  [105.325, 20.975],
  [105.365, 20.920],
  [105.430, 20.890],
  [105.515, 20.890],
  [105.600, 20.900],
  [105.660, 20.930],
  [105.685, 20.985],
  [105.680, 21.055],
  [105.655, 21.115],
  [105.600, 21.145],
  [105.520, 21.155],
  [105.430, 21.155],
  [105.360, 21.150],
  [105.335, 21.145]
];

export const CORE_SERVICE_AREAS = [
  'Yên Xuân',
  'Hòa Lạc',
  'Yên Bài',
  'Đoài Phương',
  'Thạch Thất',
  'Hạ Bằng',
  'Tây Phương',
  'Kiều Phú',
  'Phú Cát'
];

// No extra service belt for now. Keeping this export avoids breaking older UI
// code that reads the field from the GeoJSON properties.
export const EXTENDED_SERVICE_AREAS = [];

// Product camera presets for discovery. These are navigation presets, not
// legal administrative boundary definitions.
export const REGION_PRESETS = [
  { id: 'all', label: 'Toàn vùng', center: DEFAULT_CENTER, zoom: 12.35 },
  { id: 'yen-xuan', label: 'Yên Xuân', center: [105.405, 21.015], zoom: 13.8 },
  { id: 'hoa-lac', label: 'Hòa Lạc', center: [105.515, 21.015], zoom: 14.0 },
  { id: 'yen-bai', label: 'Yên Bài', center: [105.405, 21.090], zoom: 13.8 },
  { id: 'doai-phuong', label: 'Đoài Phương', center: [105.455, 21.105], zoom: 13.8 },
  { id: 'thach-that', label: 'Thạch Thất', center: [105.585, 21.030], zoom: 13.9 },
  { id: 'ha-bang', label: 'Hạ Bằng', center: [105.558, 21.055], zoom: 14.2 },
  { id: 'tay-phuong', label: 'Tây Phương', center: [105.575, 20.995], zoom: 14.0 },
  { id: 'kieu-phu', label: 'Kiều Phú', center: [105.615, 20.965], zoom: 13.8 },
  { id: 'phu-cat', label: 'Phú Cát', center: [105.475, 20.985], zoom: 13.9 }
];

/**
 * Camera/tile fence: only a small technical buffer around the nine-commune
 * product polygon, so users cannot pan out into a Hanoi-scale map.
 */
export const MAP_COVERAGE_BOUNDS = [
  [105.28, 20.86],
  [105.71, 21.18]
];

export const SERVICE_AREA_BOUNDS = [105.310, 20.890, 105.685, 21.155];

export function isInsideMapCoverageBounds(lng, lat) {
  const x = Number(lng);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const [[west, south], [east, north]] = MAP_COVERAGE_BOUNDS;
  return x >= west && x <= east && y >= south && y <= north;
}

export const SERVICE_AREA_GEOJSON = {
  type: 'Feature',
  properties: {
    id: 'hola-service-area',
    name: 'Vùng dữ liệu Hola Maps',
    coreAreas: CORE_SERVICE_AREAS,
    extendedAreas: EXTENDED_SERVICE_AREAS
  },
  geometry: {
    type: 'Polygon',
    coordinates: [SERVICE_AREA_RING]
  }
};

export const SERVICE_AREAS_GEOJSON = {
  type: 'FeatureCollection',
  features: [SERVICE_AREA_GEOJSON]
};

const [maskWest, maskSouth] = MAP_COVERAGE_BOUNDS[0];
const [maskEast, maskNorth] = MAP_COVERAGE_BOUNDS[1];

export const SERVICE_AREA_MASK_GEOJSON = {
  type: 'Feature',
  properties: { id: 'hola-service-mask' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [maskWest, maskSouth],
        [maskEast, maskSouth],
        [maskEast, maskNorth],
        [maskWest, maskNorth],
        [maskWest, maskSouth]
      ],
      // Hole = the area where the basemap stays fully visible.
      [...SERVICE_AREA_RING].reverse()
    ]
  }
};

function pointInRing(lng, lat, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

export function isInsideServiceCoverage(lng, lat) {
  const x = Number(lng);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const [west, south, east, north] = SERVICE_AREA_BOUNDS;
  if (x < west || x > east || y < south || y > north) return false;

  return pointInRing(x, y, SERVICE_AREA_RING);
}

// Kept for legacy raster-style helpers. A single focused source is cheaper
// than loading Hanoi-scale overlapping rectangle sources.
export const SERVICE_AREAS = [
  {
    id: 'hola-service-area',
    name: 'Vùng dữ liệu Hola Maps',
    bounds: SERVICE_AREA_BOUNDS
  }
];

const MAPTILER_KEY = (env.VITE_MAPTILER_KEY || '').trim();
const MAPTILER_MAP_ID = (env.VITE_MAPTILER_MAP_ID || 'streets-v4').trim();
const LOCAL_STYLE_URL = (env.VITE_LOCAL_STYLE_URL || '').trim();
const LOCAL_TILE_URL = (env.VITE_LOCAL_TILE_URL || '').trim();
const LOCAL_TILE_SIZE = Number(env.VITE_LOCAL_TILE_SIZE || 256) === 512 ? 512 : 256;

export const TILE_PROVIDER = LOCAL_STYLE_URL
  ? 'Hola Maps vector'
  : (LOCAL_TILE_URL ? 'Hola Maps local tiles' : (MAPTILER_KEY ? 'MapTiler Vector' : 'OpenStreetMap'));

export const HAS_MAPTILER_VECTOR = Boolean(MAPTILER_KEY && !LOCAL_STYLE_URL && !LOCAL_TILE_URL);

export const BASEMAP_OPTIONS = [
  { id: 'streets', label: 'Bản đồ', description: 'Đường, POI và địa danh' },
  { id: 'satellite', label: 'Vệ tinh', description: 'Ảnh vệ tinh' },
  { id: 'hybrid', label: 'Hybrid', description: 'Vệ tinh + đường + nhãn' },
  { id: 'terrain', label: 'Địa hình', description: 'Địa hình và đường' }
];

function mapTilerStyleUrl(mapId) {
  return 'https://api.maptiler.com/maps/' + encodeURIComponent(mapId) +
    '/style.json?key=' + encodeURIComponent(MAPTILER_KEY);
}

export const TILE_URL = LOCAL_TILE_URL || (
  MAPTILER_KEY
    ? 'https://api.maptiler.com/maps/' + encodeURIComponent(MAPTILER_MAP_ID) +
      '/256/{z}/{x}/{y}@2x.webp?key=' + encodeURIComponent(MAPTILER_KEY)
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
);

const TILE_SIZE = LOCAL_TILE_URL ? LOCAL_TILE_SIZE : 256;

export const STATIC_PREVIEW_URL = MAPTILER_KEY && !LOCAL_STYLE_URL && !LOCAL_TILE_URL
  ? 'https://api.maptiler.com/maps/' + encodeURIComponent(MAPTILER_MAP_ID) +
    '/static/' + DEFAULT_CENTER[0] + ',' + DEFAULT_CENTER[1] +
    ',' + DEFAULT_ZOOM + '/1200x800@2x.webp?attribution=false&key=' + encodeURIComponent(MAPTILER_KEY)
  : '';

export function createLocalBasemapStyle(mode = 'streets') {
  if (LOCAL_STYLE_URL) return LOCAL_STYLE_URL;

  if (MAPTILER_KEY && !LOCAL_TILE_URL) {
    const selected = BASEMAP_OPTIONS.find((item) => item.id === mode) || BASEMAP_OPTIONS[0];
    return mapTilerStyleUrl(selected.mapId || MAPTILER_MAP_ID);
  }

  const sources = {};
  const layers = [
    {
      id: 'hola-background',
      type: 'background',
      paint: { 'background-color': '#eef3f0' }
    }
  ];

  SERVICE_AREAS.forEach((area) => {
    const sourceId = 'hola-local-' + area.id;

    sources[sourceId] = {
      type: 'raster',
      tiles: [TILE_URL],
      tileSize: TILE_SIZE,
      minzoom: 12,
      maxzoom: 18,
      bounds: area.bounds,
      attribution: LOCAL_TILE_URL
        ? '&copy; Hola Maps'
        : '&copy; OpenStreetMap contributors'
    };

    layers.push({
      id: sourceId + '-raster',
      type: 'raster',
      source: sourceId,
      minzoom: 12,
      maxzoom: 19,
      paint: {
        'raster-fade-duration': 0,
        'raster-opacity': 1,
        'raster-contrast': 0.08,
        'raster-saturation': 0.04,
        'raster-brightness-min': 0.02,
        'raster-brightness-max': 0.98,
        'raster-resampling': 'linear'
      }
    });
  });

  return { version: 8, sources, layers };
}
