export const ACTIVITY_TYPES = ['EVENT', 'ALERT', 'FLOOD', 'ROAD_CLOSURE'];
export const ACTIVITY_LABELS = { EVENT: 'Sự kiện', ALERT: 'Cảnh báo', FLOOD: 'Ngập lụt', ROAD_CLOSURE: 'Đường đóng' };
export function validActivityBounds(viewport) {
  if (!viewport) return null;
  const { west, south, east, north } = viewport;
  if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south || west < -180 || east > 180 || south < -90 || north > 90 || east - west > 0.5 || north - south > 0.5) return null;
  return { west, south, east, north };
}
export function localActivityItems(data, kind = 'ALL', now = Date.now()) {
  const seen = new Set();
  return (Array.isArray(data?.features) ? data.features : []).filter(feature => {
    const p = feature?.properties || {};
    if (!ACTIVITY_TYPES.includes(p.layerType) || (kind !== 'ALL' && p.layerType !== kind)) return false;
    if (p.status && !['ACTIVE', 'PUBLISHED'].includes(p.status)) return false;
    const until = p.validUntil ? Date.parse(p.validUntil) : Infinity;
    const from = p.validFrom ? Date.parse(p.validFrom) : -Infinity;
    if (Number.isNaN(until) || Number.isNaN(from) || until < now || (p.layerType !== 'EVENT' && from > now)) return false;
    const id = p.layerType + ':' + String(feature.id ?? p.id ?? p.name ?? '') + ':' + String(p.validFrom ?? '');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((a,b) => {
    const time = f => Date.parse(f.properties?.validFrom || '') || 0;
    return time(b) - time(a);
  }).slice(0, 30);
}
