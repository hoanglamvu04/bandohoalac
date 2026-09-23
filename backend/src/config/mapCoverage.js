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

export function isInsideServiceCoverage(lng, lat) {
  const x = Number(lng);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  return SERVICE_AREAS.some(({ bounds }) => {
    const [west, south, east, north] = bounds;
    return x >= west && x <= east && y >= south && y <= north;
  });
}
