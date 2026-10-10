import { pool } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';
import { getNearbyPlaces, listPlaces } from './place.service.js';

const CATEGORY_ALIASES = [
  { slug: 'cafe', aliases: ['cafe', 'coffee', 'ca phe', 'quan ca phe'] },
  { slug: 'an-uong', aliases: ['nha hang', 'quan an', 'an uong', 'do an', 'mon an'] },
  { slug: 'truong-hoc', aliases: ['truong', 'truong hoc', 'mam non', 'tieu hoc', 'thpt', 'dai hoc', 'hoc vien', 'university', 'college'] },
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

const MAP_SEARCH_LAYERS = ['ROAD', 'LANDMARK'];
const NEARBY_RADII = [2500, 5000, 12000];

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
  else if (name.startsWith(query) || query.startsWith(name)) score += 70;
  else if (name.includes(query) || query.includes(name)) score += 55;

  if (candidate.preferredCategory && category === candidate.preferredCategory) score += 40;

  for (const term of candidate.preferredNameTerms || []) {
    if (name.includes(term)) score += 50;
  }

  if (item?.resultType === 'road' && /^(duong|dt|ql|quoc lo|tinh lo)/.test(query)) score += 25;

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

function mapFeatureRowToSearchItem(row) {
  const layerType = String(row.layer_type || '').toUpperCase();
  return {
    id: 'map:' + row.id,
    sourceId: row.id,
    resultType: layerType === 'ROAD' ? 'road' : 'landmark',
    name: row.name,
    category: layerType === 'ROAD' ? 'Đường' : 'Địa danh',
    categorySlug: layerType === 'ROAD' ? 'duong' : 'dia-danh',
    address: row.properties?.address || row.properties?.locality || 'Hòa Lạc, Hà Nội',
    description: row.properties?.description || '',
    lat: Number(row.lat),
    lng: Number(row.lng),
    rating: 0,
    reviews: 0,
    mapLayerType: layerType,
    properties: row.properties || {}
  };
}

export async function searchMapFeaturesByName(query, limit = 20) {
  const needle = foldSearchText(query);
  if (!needle || needle.length < 2) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 40);
  const sql = [
    'WITH service_area AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom',
    '), candidates AS (',
    '  SELECT',
    '    mf.id, mf.layer_type, mf.name, mf.properties,',
    '    ST_PointOnSurface(ST_Intersection(mf.geometry, service_area.geom)) AS point_geom,',
    '    CASE',
    '      WHEN lower(public.hola_unaccent(COALESCE(mf.name, \'\'))) = $2 THEN 0',
    '      WHEN lower(public.hola_unaccent(COALESCE(mf.name, \'\'))) LIKE $2 || \'%\' THEN 1',
    '      ELSE 2',
    '    END AS rank',
    '  FROM map_features mf',
    '  CROSS JOIN service_area',
    "  WHERE mf.status = 'ACTIVE'",
    "    AND mf.layer_type = ANY($3::text[])",
    '    AND ST_Intersects(mf.geometry, service_area.geom)',
    '    AND lower(public.hola_unaccent(COALESCE(mf.name, \'\'))) LIKE \'%\' || $2 || \'%\'',
    ')',
    'SELECT id, layer_type, name, properties,',
    '  ST_Y(point_geom) AS lat, ST_X(point_geom) AS lng',
    'FROM candidates',
    'WHERE point_geom IS NOT NULL',
    'ORDER BY rank, name',
    'LIMIT $4'
  ].join('\n');

  const { rows } = await pool.query(sql, [
    SERVICE_AREA_GEOJSON_STRING,
    needle,
    MAP_SEARCH_LAYERS,
    safeLimit
  ]);

  return rows.map(mapFeatureRowToSearchItem);
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

    const mapMatches = await searchMapFeaturesByName(candidate.query, 12);
    const anchor = selectBestAnchorMatch([...matches, ...mapMatches], candidate);
    if (anchor) return { anchor, resolvedQuery: candidate.query };
  }

  return { anchor: null, resolvedQuery: null };
}

async function nearbyWithAdaptiveRadius({ lat, lng, category, minRating }) {
  let lastItems = [];
  for (const radius of NEARBY_RADII) {
    const items = await getNearbyPlaces({
      lat,
      lng,
      radius,
      category: category || undefined,
      minRating
    });
    lastItems = items;
    if (items.length >= 5 || radius === NEARBY_RADII[NEARBY_RADII.length - 1]) {
      return { items, radius };
    }
  }
  return { items: lastItems, radius: NEARBY_RADII[NEARBY_RADII.length - 1] };
}

function dedupeSearchItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.resultType
      ? item.resultType + ':' + foldSearchText(item.name)
      : 'place:' + String(item?.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Unified local search for Hola Maps.
 *
 * - POIs come from places.
 * - Road and landmark names come from map_features.
 * - Nearby queries may use either a POI or a road/landmark as anchor.
 */
export async function smartListPlaces({ q, category, minRating, limit = 50, offset = 0 } = {}) {
  const rawQuery = String(q || '').trim();
  const explicitCategory = category && category !== 'all' ? category : null;
  const parsed = splitProximityQuery(rawQuery);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  if (!parsed) {
    const [placeItems, mapItems] = await Promise.all([
      listPlaces({ q: rawQuery, category, minRating, limit: safeLimit, offset: 0 }),
      explicitCategory ? Promise.resolve([]) : searchMapFeaturesByName(rawQuery, 24)
    ]);

    const items = dedupeSearchItems([...placeItems, ...mapItems])
      .slice(safeOffset, safeOffset + safeLimit);

    return {
      items,
      meta: {
        mode: 'unified-text',
        interpretedCategory: explicitCategory,
        includesMapFeatures: mapItems.length > 0
      }
    };
  }

  const interpretedCategory = explicitCategory || inferCategory(parsed.intent);
  const { anchor, resolvedQuery } = await resolveAnchor(parsed.anchor);

  if (!anchor) {
    const [placeItems, mapItems] = await Promise.all([
      listPlaces({ q: rawQuery, category, minRating, limit: safeLimit, offset: 0 }),
      explicitCategory ? Promise.resolve([]) : searchMapFeaturesByName(rawQuery, 20)
    ]);
    return {
      items: dedupeSearchItems([...placeItems, ...mapItems]).slice(safeOffset, safeOffset + safeLimit),
      meta: {
        mode: 'text-fallback',
        interpretedCategory,
        anchorQuery: parsed.anchor,
        anchorResolved: false
      }
    };
  }

  const nearbyResult = await nearbyWithAdaptiveRadius({
    lat: anchor.lat,
    lng: anchor.lng,
    category: interpretedCategory,
    minRating
  });

  const items = nearbyResult.items.slice(safeOffset, safeOffset + safeLimit);

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
        resultType: anchor.resultType || 'place',
        lat: anchor.lat,
        lng: anchor.lng
      },
      radius: nearbyResult.radius
    }
  };
}
