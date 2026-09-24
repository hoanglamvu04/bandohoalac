// Hola Maps performance controls
// Vector-first, PMTiles local, Hòa Lạc-only strategy.

export const HOLA_MAP_VIEWPORT = {
  minZoom: 12,
  maxZoom: 18,
  maxBounds: [
    [105.24, 20.84],
    [105.80, 21.27]
  ]
};

export const PMTILES_OPTIONS = {
  preferLocal: true,
  protocol: 'pmtiles://',
  preloadZooms: [12, 13],
  detailZoom: 18,
  vectorLayers: [
    'building',
    'transportation',
    'place',
    'poi',
    'water',
    'landuse'
  ]
};

export const LAZY_MAP_OPTIONS = {
  deferUntilVisible: true,
  rootMargin: '200px',
  keepAlive: true
};

export function isHolaArea([lng, lat]) {
  return (
    lng >= 105.24 && lng <= 105.80 &&
    lat >= 20.84 && lat <= 21.27
  );
}
