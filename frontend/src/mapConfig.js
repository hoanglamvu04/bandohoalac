const env = import.meta.env;

export const DEFAULT_CENTER = [105.515, 21.025];
export const DEFAULT_ZOOM = 12.45;
export const MIN_ZOOM = 11.7;
export const MAX_ZOOM = 18;

/**
 * Product service coverage for Hola Maps.
 *
 * This is intentionally a product coverage polygon, not a legal/official
 * administrative-boundary dataset. The Hòa Lạc / new Thạch Thất core stays
 * central, while the service belt is expanded by roughly 2-3 commune widths
 * in every direction so the map no longer feels cut off at the old edge.
 *
 * When an authoritative commune-boundary GeoJSON is available, replace only
 * SERVICE_AREA_RING; every map/API filter continues to work unchanged.
 */
export const SERVICE_AREA_RING = [
  [105.275, 21.235],
  [105.250, 21.175],
  [105.250, 21.095],
  [105.265, 21.015],
  [105.295, 20.945],
  [105.340, 20.885],
  [105.405, 20.845],
  [105.495, 20.825],
  [105.595, 20.830],
  [105.685, 20.855],
  [105.750, 20.905],
  [105.785, 20.970],
  [105.790, 21.050],
  [105.775, 21.125],
  [105.745, 21.195],
  [105.675, 21.225],
  [105.585, 21.240],
  [105.485, 21.245],
  [105.380, 21.245],
  [105.305, 21.245],
  [105.275, 21.235]
];

export const CORE_SERVICE_AREAS = [
  'Hòa Lạc',
  'Hạ Bằng',
  'Thạch Thất',
  'Tây Phương',
  'Yên Xuân',
  'Phú Cát'
];

export const EXTENDED_SERVICE_AREAS = [
  'Vành đai phía Bắc Hòa Lạc',
  'Vành đai phía Nam Hòa Lạc',
  'Vành đai phía Đông Hòa Lạc',
  'Vành đai phía Tây Hòa Lạc',
  'Khu vực lân cận Ba Vì',
  'Khu vực lân cận Quốc Oai'
];

// Product camera presets for discovery. These are navigation presets, not
// legal administrative boundary definitions.
export const REGION_PRESETS = [
  { id: 'all', label: 'Toàn vùng', center: DEFAULT_CENTER, zoom: 11.95 },
  { id: 'hoa-lac', label: 'Hòa Lạc', center: [105.515, 21.015], zoom: 14.0 },
  { id: 'ha-bang', label: 'Hạ Bằng', center: [105.558, 21.055], zoom: 14.2 },
  { id: 'thach-that', label: 'Thạch Thất', center: [105.585, 21.030], zoom: 13.9 },
  { id: 'tay-phuong', label: 'Tây Phương', center: [105.575, 20.995], zoom: 14.0 },
  { id: 'yen-xuan', label: 'Yên Xuân', center: [105.405, 21.015], zoom: 13.8 },
  { id: 'phu-cat', label: 'Phú Cát', center: [105.475, 20.985], zoom: 13.9 }
];

/**
 * Camera fence with a visual/tile buffer around the expanded service polygon.
 * The product still stays focused on Hòa Lạc instead of exposing all Hanoi.
 */
export const MAP_COVERAGE_BOUNDS = [
  [105.21, 20.79],
  [105.83, 21.29]
];

export const SERVICE_AREA_BOUNDS = [105.250, 20.825, 105.790, 21.245];

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
