import { getNearbyPlaces, listPlaces } from './place.service.js';

const CATEGORY_ALIASES = [
  { slug: 'cafe', aliases: ['cafe', 'coffee', 'ca phe', 'quan ca phe'] },
  { slug: 'an-uong', aliases: ['nha hang', 'quan an', 'an uong', 'do an', 'mon an'] },
  { slug: 'truong-hoc', aliases: ['truong', 'truong hoc', 'mam non', 'tieu hoc', 'thpt', 'dai hoc', 'hoc vien'] },
  { slug: 'y-te', aliases: ['benh vien', 'phong kham', 'y te', 'bac si', 'nha thuoc'] },
  { slug: 'sieu-thi', aliases: ['sieu thi', 'cua hang', 'tap hoa', 'shopping'] },
  { slug: 'ngan-hang-atm', aliases: ['ngan hang', 'atm'] },
  { slug: 'khu-du-lich', aliases: ['du lich', 'khu du lich', 'di choi', 'tham quan'] },
  { slug: 'homestay', aliases: ['homestay', 'luu tru'] },
  { slug: 'villa', aliases: ['villa', 'biet thu'] },
  { slug: 'giao-thong', aliases: ['ben xe', 'tram xe', 'xe buyt', 'giao thong'] },
  { slug: 'nhien-lieu-sac', aliases: ['tram sac', 'cay xang', 'tram xang', 'nhien lieu'] },
  { slug: 'the-thao', aliases: ['gym', 'the thao', 'san bong', 'fitness'] },
  { slug: 'dich-vu', aliases: ['dich vu', 'spa', 'salon', 'sua xe'] },
  { slug: 'bat-dong-san', aliases: ['bat dong san', 'nha dat', 'dat', 'dat nen', 'du an'] }
];

const PROXIMITY_PATTERNS = [
  /\s+gần\s+/i,
  /\s+quanh\s+/i,
  /\s+xung quanh\s+/i,
  /\s+ở\s+/i,
  /\s+tại\s+/i,
  /\s+gan\s+/i,
  /\s+o\s+/i,
  /\s+tai\s+/i
];

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCategory(query) {
  const haystack = fold(query);
  for (const item of CATEGORY_ALIASES) {
    if (item.aliases.some((alias) => haystack.includes(alias))) return item.slug;
  }
  return null;
}

function splitProximityQuery(query) {
  const text = String(query || '').trim();
  if (!text) return null;

  for (const pattern of PROXIMITY_PATTERNS) {
    const match = text.match(pattern);
    if (!match || match.index === undefined) continue;

    const left = text.slice(0, match.index).trim();
    const right = text.slice(match.index + match[0].length).trim();
    if (!left || !right) continue;
    return { intent: left, anchor: right };
  }

  return null;
}

function normalizeLimit(value, fallback = 50) {
  return Math.min(Math.max(Number(value) || fallback, 1), 100);
}

/**
 * Smart search keeps the normal fuzzy text search as the default, then adds a
 * small local-intent parser for queries such as:
 *   - "quán cafe gần FPT"
 *   - "trường mầm non ở Hạ Bằng"
 *   - "đất quanh Đại học Quốc gia"
 *
 * The anchor is resolved against Hola Maps' own places first. This keeps the
 * feature deterministic and local instead of depending on an external geocoder.
 */
export async function smartListPlaces({ q, category, minRating, limit = 50, offset = 0 } = {}) {
  const rawQuery = String(q || '').trim();
  const explicitCategory = category && category !== 'all' ? category : null;
  const parsed = splitProximityQuery(rawQuery);

  if (!parsed) {
    const items = await listPlaces({ q: rawQuery, category, minRating, limit, offset });
    return {
      items,
      meta: { mode: 'text', interpretedCategory: explicitCategory }
    };
  }

  const interpretedCategory = explicitCategory || inferCategory(parsed.intent);
  const anchorMatches = await listPlaces({
    q: parsed.anchor,
    limit: 8,
    offset: 0
  });
  const anchor = anchorMatches[0] || null;

  if (!anchor || !Number.isFinite(Number(anchor.lat)) || !Number.isFinite(Number(anchor.lng))) {
    const items = await listPlaces({ q: rawQuery, category, minRating, limit, offset });
    return {
      items,
      meta: {
        mode: 'text-fallback',
        interpretedCategory,
        anchorQuery: parsed.anchor,
        anchorResolved: false
      }
    };
  }

  const nearby = await getNearbyPlaces({
    lat: anchor.lat,
    lng: anchor.lng,
    radius: 12000,
    category: interpretedCategory || undefined,
    minRating
  });

  const safeLimit = normalizeLimit(limit);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const items = nearby.slice(safeOffset, safeOffset + safeLimit);

  return {
    items,
    meta: {
      mode: 'near-anchor',
      interpretedCategory,
      anchorQuery: parsed.anchor,
      anchorResolved: true,
      anchor: {
        id: anchor.id,
        name: anchor.name,
        lat: anchor.lat,
        lng: anchor.lng
      },
      radius: 12000
    }
  };
}
