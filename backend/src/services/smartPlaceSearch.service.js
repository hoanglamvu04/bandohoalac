import { pool } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';
import { getNearbyPlaces, listPlaces } from './place.service.js';

const CATEGORY_ALIASES = [
  { slug: 'cafe', aliases: ['cafe', 'coffee', 'ca phe', 'quan ca phe'] },
  { slug: 'an-uong', aliases: ['nha hang', 'quan an', 'an uong', 'do an', 'mon an'] },
  { slug: 'truong-hoc', aliases: ['truong', 'truong hoc', 'mam non', 'tieu hoc', 'thpt', 'dai hoc', 'hoc vien', 'university'] },
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

const NEAR_ME_ALIASES = new Set([
  'toi', 'gan toi', 'quanh toi', 'vi tri toi', 'vi tri cua toi', 'cho toi dang dung', 'day'
]);

export function foldSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s.-]/g, ' ')
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

function mapFeatureRow(row) {
  const isRoad = row.layer_type === 'ROAD';
  return {
    id: 'map-' + String(row.layer_type || 'feature').toLowerCase() + '-' + row.id,
    mapFeatureId: row.id,
    searchEntityType: row.layer_type,
    name: row.name || row.reference || (isRoad ? 'Tuyến đường' : 'Địa danh'),
    slug: null,
    description: row.description || '',
    address: isRoad ? 'Tuyến đường · Hola Maps' : 'Địa danh · Hola Maps',
    phone: null,
    website: null,
    priceLevel: null,
    openingHours: null,
    status: 'PUBLISHED',
    source: 'HOLA_MAPS',
    rating: 0,
    reviews: 0,
    lat: Number(row.lat),
    lng: Number(row.lng),
    category: isRoad ? 'Tuyến đường' : 'Địa danh',
    categorySlug: isRoad ? 'giao-thong' : 'dia-danh',
    images: [],
    thumbnails: [],
    cardImages: []
  };
}

async function searchMapFeatures(query, limit = 20) {
  const needle = String(query || '').trim();
  if (!needle) return [];

  const sql = [
    'WITH service_area AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom',
    '), candidates AS (',
    '  SELECT mf.id, mf.layer_type, mf.name, mf.properties, mf.geometry',
    '  FROM map_features mf, service_area',
    "  WHERE mf.status = 'ACTIVE'",
    "    AND mf.layer_type IN ('ROAD', 'LANDMARK')",
    '    AND ST_Intersects(mf.geometry, service_area.geom)',
    '    AND (',
    "      lower(public.hola_unaccent(COALESCE(mf.name, ''))) LIKE '%' || lower(public.hola_unaccent($2)) || '%'",
    "      OR lower(public.hola_unaccent(COALESCE(mf.properties->>'ref', ''))) LIKE '%' || lower(public.hola_unaccent($2)) || '%'",
    "      OR similarity(lower(public.hola_unaccent(COALESCE(mf.name, ''))), lower(public.hola_unaccent($2))) >= 0.25",
    '    )',
    '  ORDER BY',
    "    CASE WHEN lower(public.hola_unaccent(COALESCE(mf.name, ''))) = lower(public.hola_unaccent($2)) THEN 0 ELSE 1 END,",
    "    similarity(lower(public.hola_unaccent(COALESCE(mf.name, ''))), lower(public.hola_unaccent($2))) DESC,",
    '    mf.updated_at DESC',
    '  LIMIT $3',
    ')',
    'SELECT',
    '  id, layer_type, name,',
    "  properties->>'ref' AS reference,",
    "  properties->>'description' AS description,",
    '  ST_X(ST_PointOnSurface(geometry)) AS lng,',
    '  ST_Y(ST_PointOnSurface(geometry)) AS lat',
    'FROM candidates'
  ].join('\n');

  const { rows } = await pool.query(sql, [
    SERVICE_AREA_GEOJSON_STRING,
    needle,
    Math.min(Math.max(Number(limit) || 20, 1), 40)
  ]);
  return rows.map(mapFeatureRow).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
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

  const mapMatches = await searchMapFeatures(anchorQuery, 8);
  const anchor = mapMatches[0] || null;
  return { anchor, resolvedQuery: anchor ? anchorQuery : null };
}

async function nearbyWithProgressiveRadius({ lat, lng, category, minRating }) {
  let items = [];
  let radius = 2000;

  for (const candidateRadius of [2000, 5000, 10000, 12000]) {
    radius = candidateRadius;
    items = await getNearbyPlaces({ lat, lng, radius, category: category || undefined, minRating });
    if (items.length >= 6 || (items.length > 0 && radius >= 10000)) break;
  }

  return { items, radius };
}

/**
 * Unified discovery search for Hola Maps.
 * - normal text: places + named ROAD/LANDMARK map features
 * - "cafe gần FPT": resolve canonical anchor then progressively expand radius
 * - "cafe gần tôi": use caller-provided browser coordinates
 */
export async function smartListPlaces({
  q,
  category,
  minRating,
  limit = 50,
  offset = 0,
  lat,
  lng
} = {}) {
  const rawQuery = String(q || '').trim();
  const explicitCategory = category && category !== 'all' ? category : null;
  const parsed = splitProximityQuery(rawQuery);

  if (!parsed) {
    const [placeItems, mapItems] = await Promise.all([
      listPlaces({ q: rawQuery, category, minRating, limit, offset }),
      rawQuery ? searchMapFeatures(rawQuery, Math.min(Number(limit) || 20, 20)) : Promise.resolve([])
    ]);

    const items = [...placeItems, ...mapItems].slice(0, normalizeLimit(limit));
    return {
      items,
      meta: {
        mode: 'unified-text',
        interpretedCategory: explicitCategory,
        mapResultCount: mapItems.length
      }
    };
  }

  const interpretedCategory = explicitCategory || inferCategory(parsed.intent);
  const foldedAnchor = foldSearchText(parsed.anchor);
  const userLat = Number(lat);
  const userLng = Number(lng);

  let anchor = null;
  let resolvedQuery = null;
  let anchorMode = 'place';

  if (NEAR_ME_ALIASES.has(foldedAnchor) && Number.isFinite(userLat) && Number.isFinite(userLng)) {
    anchor = { id: 'current-location', name: 'Vị trí của tôi', lat: userLat, lng: userLng };
    resolvedQuery = 'Vị trí của tôi';
    anchorMode = 'user-location';
  } else {
    const resolved = await resolveAnchor(parsed.anchor);
    anchor = resolved.anchor;
    resolvedQuery = resolved.resolvedQuery;
  }

  if (!anchor) {
    const [placeItems, mapItems] = await Promise.all([
      listPlaces({ q: rawQuery, category, minRating, limit, offset }),
      searchMapFeatures(parsed.anchor, 10)
    ]);
    return {
      items: [...placeItems, ...mapItems].slice(0, normalizeLimit(limit)),
      meta: {
        mode: 'text-fallback',
        interpretedCategory,
        anchorQuery: parsed.anchor,
        anchorResolved: false
      }
    };
  }

  const nearby = await nearbyWithProgressiveRadius({
    lat: Number(anchor.lat),
    lng: Number(anchor.lng),
    category: interpretedCategory,
    minRating
  });

  const safeLimit = normalizeLimit(limit);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const items = nearby.items.slice(safeOffset, safeOffset + safeLimit);

  return {
    items,
    meta: {
      mode: 'near-anchor',
      anchorMode,
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
      radius: nearby.radius
    }
  };
}
