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

const LANDMARK_ALIASES = [
  {
    aliases: ['fpt', 'fpt hoa lac', 'dai hoc fpt', 'truong dai hoc fpt', 'fpt university'],
    queries: ['Trường Đại học FPT', 'Đại học FPT', 'FPT University', 'FPT'],
    preferredCategory: 'truong-hoc',
    preferredNameTerms: ['dai hoc fpt', 'fpt university']
  },
  {
    aliases: ['dhqg', 'dhqg ha noi', 'dai hoc quoc gia', 'dai hoc quoc gia ha noi', 'vnu'],
    queries: ['Đại học Quốc gia Hà Nội', 'ĐHQG Hà Nội', 'VNU'],
    preferredCategory: 'truong-hoc',
    preferredNameTerms: ['dai hoc quoc gia', 'dhqg', 'vnu']
  },
  {
    aliases: ['cnc', 'cnc hoa lac', 'khu cnc', 'khu cong nghe cao', 'khu cong nghe cao hoa lac'],
    queries: ['Khu Công nghệ cao Hòa Lạc', 'CNC Hòa Lạc'],
    preferredCategory: null,
    preferredNameTerms: ['khu cong nghe cao', 'cnc hoa lac']
  }
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

export function foldSearchText(value) {
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
  const haystack = foldSearchText(query);
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

function landmarkDefinition(anchorQuery) {
  const folded = foldSearchText(anchorQuery);
  return LANDMARK_ALIASES.find((item) =>
    item.aliases.some((alias) => folded === alias || folded.includes(alias))
  ) || null;
}

export function anchorCandidates(anchorQuery) {
  const definition = landmarkDefinition(anchorQuery);
  const raw = String(anchorQuery || '').trim();

  if (!definition) {
    return [{ query: raw, preferredCategory: null, preferredNameTerms: [] }].filter((item) => item.query);
  }

  const candidates = definition.queries.map((query) => ({
    query,
    preferredCategory: definition.preferredCategory,
    preferredNameTerms: definition.preferredNameTerms
  }));

  if (raw && !candidates.some((item) => foldSearchText(item.query) === foldSearchText(raw))) {
    candidates.push({
      query: raw,
      preferredCategory: definition.preferredCategory,
      preferredNameTerms: definition.preferredNameTerms
    });
  }

  return candidates;
}

function anchorScore(item, candidate) {
  const name = foldSearchText(item?.name);
  const query = foldSearchText(candidate.query);
  const category = item?.categorySlug || '';
  let score = 0;

  if (name === query) score += 100;
  else if (name.includes(query) || query.includes(name)) score += 55;

  if (candidate.preferredCategory && category === candidate.preferredCategory) score += 40;

  for (const term of candidate.preferredNameTerms || []) {
    if (name.includes(term)) score += 50;
  }

  // Avoid using a shop/bank carrying the FPT/VNU keyword as the geographic anchor.
  if (/\b(shop|store|bank|atm|livebank|polytechnic)\b/.test(name)) score -= 45;

  score += Math.min(Number(item?.reviews) || 0, 20) * 0.1;
  return score;
}

export function selectBestAnchorMatch(items, candidate) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng)))
    .map((item) => ({ item, score: anchorScore(item, candidate) }))
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

async function resolveAnchor(anchorQuery) {
  for (const candidate of anchorCandidates(anchorQuery)) {
    let matches = [];

    if (candidate.preferredCategory) {
      matches = await listPlaces({
        q: candidate.query,
        category: candidate.preferredCategory,
        limit: 12,
        offset: 0
      });
    }

    if (!matches.length) {
      matches = await listPlaces({ q: candidate.query, limit: 12, offset: 0 });
    }

    const anchor = selectBestAnchorMatch(matches, candidate);
    if (anchor) return { anchor, resolvedQuery: candidate.query };
  }

  return { anchor: null, resolvedQuery: null };
}

/**
 * Smart search keeps the normal fuzzy text search as the default, then adds a
 * local-intent parser for queries such as:
 *   - "quán cafe gần FPT"
 *   - "trường mầm non ở Hạ Bằng"
 *   - "đất quanh Đại học Quốc gia"
 *
 * Known Hòa Lạc landmarks are resolved using canonical names/category first.
 * This prevents keyword-bearing shops, banks or stale legacy records from
 * becoming the geographic anchor for a nearby query.
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
  const { anchor, resolvedQuery } = await resolveAnchor(parsed.anchor);

  if (!anchor) {
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
      anchorResolvedQuery: resolvedQuery,
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
