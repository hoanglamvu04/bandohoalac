/**
 * Product service coverage for Hola Maps.
 *
 * Public data is limited to the nine communes currently served by the project:
 * Yên Xuân, Hòa Lạc, Yên Bài, Đoài Phương, Thạch Thất, Hạ Bằng,
 * Tây Phương, Kiều Phú and Phú Cát.
 *
 * IMPORTANT: the old SERVICE_AREA_RING is retained only as a camera/tile fence.
 * Public POI/map queries use SERVICE_AREA_GEOMETRY below, which is a union of
 * nine tighter local service zones instead of one large envelope. This avoids
 * accidentally accepting places from Đan Phượng, Hoài Đức, Phúc Thọ, etc.
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

// Product zones are deliberately tighter than the technical tile/camera fence.
// Radius values are conservative discovery radii around each served commune.
// They can later be replaced by authoritative cadastral GeoJSON without
// changing consumers: all backend filters read SERVICE_AREA_GEOMETRY.
export const SERVICE_AREA_ZONES = [
  { id: 'yen-xuan', name: 'Yên Xuân', center: [105.405, 21.015], radiusMeters: 8500 },
  { id: 'hoa-lac', name: 'Hòa Lạc', center: [105.515, 21.015], radiusMeters: 8000 },
  { id: 'yen-bai', name: 'Yên Bài', center: [105.405, 21.090], radiusMeters: 8000 },
  { id: 'doai-phuong', name: 'Đoài Phương', center: [105.455, 21.105], radiusMeters: 7000 },
  { id: 'thach-that', name: 'Thạch Thất', center: [105.585, 21.030], radiusMeters: 7000 },
  { id: 'ha-bang', name: 'Hạ Bằng', center: [105.558, 21.055], radiusMeters: 6000 },
  { id: 'tay-phuong', name: 'Tây Phương', center: [105.575, 20.995], radiusMeters: 6000 },
  { id: 'kieu-phu', name: 'Kiều Phú', center: [105.615, 20.965], radiusMeters: 6500 },
  { id: 'phu-cat', name: 'Phú Cát', center: [105.475, 20.985], radiusMeters: 7000 }
];

function circleRing([lng, lat], radiusMeters, segments = 28) {
  const latRadius = radiusMeters / 111320;
  const lonRadius = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    ring.push([
      lng + Math.cos(angle) * lonRadius,
      lat + Math.sin(angle) * latRadius
    ]);
  }

  return ring;
}

export const SERVICE_AREA_GEOMETRY = {
  type: 'MultiPolygon',
  coordinates: SERVICE_AREA_ZONES.map((zone) => [
    circleRing(zone.center, zone.radiusMeters)
  ])
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

function distanceMeters(lngA, latA, lngB, latB) {
  const earthRadius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function serviceZoneForPoint(lng, lat) {
  const x = Number(lng);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let best = null;
  for (const zone of SERVICE_AREA_ZONES) {
    const distance = distanceMeters(x, y, zone.center[0], zone.center[1]);
    if (distance > zone.radiusMeters) continue;
    if (!best || distance < best.distanceMeters) {
      best = { ...zone, distanceMeters: Math.round(distance) };
    }
  }
  return best;
}

export function isInsideServiceCoverage(lng, lat) {
  return Boolean(serviceZoneForPoint(lng, lat));
}
