const env = import.meta.env;

export const DEFAULT_CENTER = [105.515, 21.015];
export const DEFAULT_ZOOM = 13.15;
export const MIN_ZOOM = 12.25;
export const MAX_ZOOM = 18;

/**
 * Product service coverage for Hola Maps.
 *
 * This is intentionally a product coverage polygon, not a legal/official
 * administrative-boundary dataset. It keeps the app focused on the new
 * Thạch Thất / Hòa Lạc service cluster requested for the product:
 * Hòa Lạc, Hạ Bằng, Thạch Thất, Tây Phương, Yên Xuân, Phú Cát plus only
 * the nearby parts of Ba Vì and Quốc Oai.
 *
 * When an authoritative commune-boundary GeoJSON is available, replace only
 * SERVICE_AREA_RING; every map/API filter continues to work unchanged.
 */
export const SERVICE_AREA_RING = [
  [105.335, 21.145],
  [105.390, 21.145],
  [105.455, 21.118],
  [105.520, 21.122],
  [105.590, 21.110],
  [105.650, 21.095],
  [105.682, 21.055],
  [105.675, 21.015],
  [105.660, 20.975],
  [105.640, 20.935],
  [105.610, 20.900],
  [105.565, 20.885],
  [105.515, 20.888],
  [105.475, 20.905],
  [105.440, 20.930],
  [105.405, 20.950],
  [105.370, 20.985],
  [105.345, 21.030],
  [105.325, 21.080],
  [105.335, 21.145]
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
  'Một phần Ba Vì',
  'Một phần Quốc Oai'
];

/**
 * Tight camera fence with a small visual buffer around the actual service
 * polygon. This replaces the old Hanoi-scale 105.24..105.80 / 20.84..21.27
 * rectangle, so remote tiles are no longer requested far away from Hòa Lạc.
 */
export const MAP_COVERAGE_BOUNDS = [
  [105.30, 20.86],
  [105.70, 21.16]
];

export const SERVICE_AREA_BOUNDS = [105.325, 20.885, 105.682, 21.145];

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

// Kept for legacy raster-style helpers. A single tight source is cheaper than
// the previous nine overlapping rectangle sources.
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
