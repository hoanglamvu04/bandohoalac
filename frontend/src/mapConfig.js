const env = import.meta.env;

export const DEFAULT_CENTER = [105.525, 21.005];
export const DEFAULT_ZOOM = 13.3;
export const MIN_ZOOM = 12.15;
export const MAX_ZOOM = 18;

// Overall camera fence. Tiles are NOT served for this whole rectangle;
// individual raster sources below each have their own much smaller bounds.
export const MAP_COVERAGE_BOUNDS = [
  [105.24, 20.84],
  [105.80, 21.27]
];

// Local service patches. These are deliberately split instead of using one
// Hanoi/world source so MapLibre requests tiles only when a viewport
// intersects an enabled Hola Maps area.
export const SERVICE_AREAS = [
  { id: 'hoa-lac', name: 'Hòa Lạc', bounds: [105.455, 20.955, 105.590, 21.055] },
  { id: 'yen-xuan', name: 'Yên Xuân', bounds: [105.390, 20.935, 105.495, 21.035] },
  { id: 'thach-that', name: 'Thạch Thất', bounds: [105.500, 20.970, 105.650, 21.105] },
  { id: 'tay-phuong', name: 'Tây Phương', bounds: [105.535, 21.015, 105.610, 21.080] },
  { id: 'ha-bang', name: 'Hạ Bằng', bounds: [105.515, 20.985, 105.590, 21.055] },
  { id: 'phu-cat', name: 'Phú Cát', bounds: [105.485, 20.905, 105.575, 20.995] },
  { id: 'ba-vi', name: 'Ba Vì', bounds: [105.245, 20.960, 105.475, 21.265] },
  { id: 'quoc-oai', name: 'Quốc Oai', bounds: [105.470, 20.845, 105.675, 21.020] },
  { id: 'hoai-duc', name: 'Hoài Đức', bounds: [105.620, 20.975, 105.795, 21.105] }
];

const MAPTILER_KEY = (env.VITE_MAPTILER_KEY || '').trim();
const MAPTILER_MAP_ID = (env.VITE_MAPTILER_MAP_ID || 'streets-v4').trim();
const LOCAL_STYLE_URL = (env.VITE_LOCAL_STYLE_URL || '').trim();
const LOCAL_TILE_URL = (env.VITE_LOCAL_TILE_URL || '').trim();
const LOCAL_TILE_SIZE = Number(env.VITE_LOCAL_TILE_SIZE || 256) === 512 ? 512 : 256;

export const TILE_PROVIDER = LOCAL_STYLE_URL
  ? 'Hola Maps vector'
  : (LOCAL_TILE_URL ? 'Hola Maps local tiles' : (MAPTILER_KEY ? 'MapTiler' : 'OpenStreetMap'));

export const TILE_URL = LOCAL_TILE_URL || (
  MAPTILER_KEY
    ? 'https://api.maptiler.com/maps/' + encodeURIComponent(MAPTILER_MAP_ID) +
      '/512/{z}/{x}/{y}.webp?key=' + encodeURIComponent(MAPTILER_KEY)
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
);

const TILE_SIZE = LOCAL_TILE_URL
  ? LOCAL_TILE_SIZE
  : (MAPTILER_KEY ? 512 : 256);

export const STATIC_PREVIEW_URL = MAPTILER_KEY && !LOCAL_STYLE_URL && !LOCAL_TILE_URL
  ? 'https://api.maptiler.com/maps/' + encodeURIComponent(MAPTILER_MAP_ID) +
    '/static/' + DEFAULT_CENTER[0] + ',' + DEFAULT_CENTER[1] +
    ',' + DEFAULT_ZOOM + '/1200x800.webp?attribution=false&key=' + encodeURIComponent(MAPTILER_KEY)
  : '';

export function isInsideServiceCoverage(lng, lat) {
  const x = Number(lng);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  return SERVICE_AREAS.some(({ bounds }) => {
    const [west, south, east, north] = bounds;
    return x >= west && x <= east && y >= south && y <= north;
  });
}

export function createLocalBasemapStyle() {
  if (LOCAL_STYLE_URL) return LOCAL_STYLE_URL;

  const sources = {};
  const layers = [
    {
      id: 'hola-background',
      type: 'background',
      paint: { 'background-color': '#f1f3ef' }
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
        'raster-contrast': 0.12,
        'raster-saturation': 0.08,
        'raster-brightness-min': 0.02,
        'raster-brightness-max': 0.98,
        'raster-resampling': 'linear'
      }
    });
  });

  return { version: 8, sources, layers };
}

export const SERVICE_AREAS_GEOJSON = {
  type: 'FeatureCollection',
  features: SERVICE_AREAS.map((area) => {
    const [west, south, east, north] = area.bounds;
    return {
      type: 'Feature',
      properties: { id: area.id, name: area.name },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south]
        ]]
      }
    };
  })
};
