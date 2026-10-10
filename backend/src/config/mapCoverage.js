/**
 * Product service coverage for Hola Maps.
 *
 * Active product area is limited to the nine communes currently served by the
 * project: Yên Xuân, Hòa Lạc, Yên Bài, Đoài Phương, Thạch Thất, Hạ Bằng,
 * Tây Phương, Kiều Phú and Phú Cát.
 *
 * This is a tight product-coverage boundary, not a legal cadastral boundary.
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

export const SERVICE_AREA_BOUNDS = [105.310, 20.890, 105.685, 21.155];

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

export const EXTENDED_SERVICE_AREAS = [];

export const SERVICE_AREA_GEOMETRY = {
  type: 'Polygon',
  coordinates: [SERVICE_AREA_RING]
};

export const SERVICE_AREA_GEOJSON_STRING = JSON.stringify(SERVICE_AREA_GEOMETRY);

// Backwards-compatible export for code that still expects SERVICE_AREAS.
export const SERVICE_AREAS = [
  {
    id: 'hola-service-area',
    name: 'Vùng dữ liệu Hola Maps',
    bounds: SERVICE_AREA_BOUNDS
  }
];

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
