/**
 * Product service coverage for Hola Maps.
 *
 * The Hòa Lạc / new Thạch Thất core remains central, while the product
 * coverage is expanded by roughly 2-3 commune widths in every direction.
 * This is a product-coverage boundary, not a legal cadastral boundary.
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

export const SERVICE_AREA_BOUNDS = [105.250, 20.825, 105.790, 21.245];

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
