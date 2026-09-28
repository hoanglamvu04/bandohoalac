function parseClock(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isPlaceOpenNow(openingHours, now = new Date()) {
  const raw = String(openingHours || '').trim();
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replace(/\s+/g, ' ');

  if (
    normalized === '24/7' ||
    normalized === '24h' ||
    normalized.includes('24 giờ') ||
    normalized.includes('mở cả ngày')
  ) {
    return true;
  }

  const match = normalized.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;

  const start = parseClock(match[1]);
  const end = parseClock(match[2]);
  if (start === null || end === null) return null;

  const current = now.getHours() * 60 + now.getMinutes();

  if (start === end) return true;
  if (end > start) return current >= start && current < end;

  // Overnight ranges such as 18:00 - 02:00.
  return current >= start || current < end;
}

export function distanceMeters(aLat, aLng, bLat, bLng) {
  const lat1 = Number(aLat);
  const lng1 = Number(aLng);
  const lat2 = Number(bLat);
  const lng2 = Number(bLng);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const radius = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      sinLng * sinLng;

  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatOpenStatus(openingHours, now = new Date()) {
  const open = isPlaceOpenNow(openingHours, now);
  if (open === true) return { known: true, open: true, label: 'Đang mở' };
  if (open === false) return { known: true, open: false, label: 'Đã đóng' };
  return { known: false, open: false, label: 'Chưa rõ giờ' };
}
