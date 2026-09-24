/**
 * Product service coverage for Hola Maps.
 *
 * This polygon is deliberately smaller than the old Hanoi-scale rectangles.
 * It represents the product coverage requested for Hòa Lạc / new Thạch Thất:
 * Hòa Lạc, Hạ Bằng, Thạch Thất, Tây Phương, Yên Xuân, Phú Cát and only the
 * nearby parts of Ba Vì + Quốc Oai.
 *
 * It is a product-coverage boundary, not a legal cadastral boundary.
 */
export const SERVICE_AREA_RING = [
  [105.335, 21.145],
  [105.325, 21.080],
  [105.345, 21.030],
  [105.370, 20.985],
  [105.405, 20.950],
  [105.440, 20.930],
  [105.475, 20.905],
  [105.515, 20.888],
  [105.565, 20.885],
  [105.610, 20.900],
  [105.640, 20.935],
  [105.660, 20.975],
  [105.675, 21.015],
  [105.682, 21.055],
  [105.650, 21.095],
  [105.590, 21.110],
  [105.520, 21.122],
  [105.455, 21.118],
  [105.390, 21.145],
  [105.335, 21.145]
];

export const SERVICE_AREA_BOUNDS = [105.325, 20.885, 105.682, 21.145];

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
