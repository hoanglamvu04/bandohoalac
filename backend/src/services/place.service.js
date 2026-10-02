import { pool } from '../database/pool.js';
import { slugify } from '../utils/slugify.js';
import {
  SERVICE_AREA_GEOJSON_STRING,
  isInsideServiceCoverage
} from '../config/mapCoverage.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

const BASE_SELECT = [
  'SELECT',
  '  p.id,',
  '  p.name,',
  '  p.slug,',
  '  p.description,',
  '  p.address,',
  '  p.phone,',
  '  p.website,',
  '  p.price_level,',
  '  p.opening_hours,',
  '  p.status,',
  '  p.source,',
  '  p.created_by,',
  '  p.rating_avg,',
  '  p.rating_count,',
  '  p.created_at,',
  '  p.updated_at,',
  '  ST_X(p.location) AS lng,',
  '  ST_Y(p.location) AS lat,',
  '  c.name AS category,',
  '  c.slug AS category_slug,',
  "  EXISTS (SELECT 1 FROM place_partners pp WHERE pp.place_id = p.id AND pp.status = 'ACTIVE') AS is_partner,",
  "  (SELECT pp.partner_name FROM place_partners pp WHERE pp.place_id = p.id AND pp.status = 'ACTIVE' LIMIT 1) AS partner_name,",
  "  COALESCE((SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC) FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS images,",
  "  COALESCE((SELECT json_agg(COALESCE(pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC) FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS thumbnails,",
  "  COALESCE((SELECT json_agg(COALESCE(pi.card_url, pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC) FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS card_images",
  'FROM places p',
  'LEFT JOIN categories c ON c.id = p.category_id'
].join('\n');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    address: row.address,
    phone: row.phone,
    website: row.website,
    priceLevel: row.price_level,
    openingHours: row.opening_hours,
    status: row.status,
    source: row.source,
    createdBy: row.created_by,
    rating: Number(row.rating_avg) || 0,
    reviews: Number(row.rating_count) || 0,
    favoriteCount: Number(row.favorite_count) || 0,
    featuredScore: row.featured_score !== undefined && row.featured_score !== null
      ? Number(row.featured_score)
      : undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    category: row.category || 'Địa điểm',
    categorySlug: row.category_slug || 'other',
    isPartner: Boolean(row.is_partner),
    partnerName: row.partner_name || null,
    images: Array.isArray(row.images) ? row.images : [],
    thumbnails: Array.isArray(row.thumbnails)
      ? row.thumbnails
      : (Array.isArray(row.images) ? row.images : []),
    cardImages: Array.isArray(row.card_images)
      ? row.card_images
      : (Array.isArray(row.thumbnails)
          ? row.thumbnails
          : (Array.isArray(row.images) ? row.images : [])),
    distance: row.distance_m !== undefined && row.distance_m !== null
      ? Math.round(Number(row.distance_m))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const PLACE_SEARCH_TEXT_SQL =
  "lower(public.hola_unaccent(" +
  "COALESCE(p.name, '') || ' ' || " +
  "COALESCE(p.address, '') || ' ' || " +
  "COALESCE(p.description, '')" +
  "))";

const PLACE_NAME_SEARCH_SQL =
  "lower(public.hola_unaccent(COALESCE(p.name, '')))";

const CATEGORY_SEARCH_SQL =
  "lower(public.hola_unaccent(COALESCE(c.name, '')))";

const placeBoundsCache = new Map();

function normalizedCacheNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : '0';
}

function placeBoundsCacheKey(args = {}) {
  return [
    normalizedCacheNumber(args.west),
    normalizedCacheNumber(args.south),
    normalizedCacheNumber(args.east),
    normalizedCacheNumber(args.north),
    String(args.status || 'PUBLISHED'),
    String(args.category || 'all'),
    args.minRating === undefined || args.minRating === null || args.minRating === ''
      ? ''
      : String(Number(args.minRating))
  ].join('|');
}

export function invalidatePlaceBoundsCache() {
  placeBoundsCache.clear();
}

export async function getPlacesInBoundsCached(args = {}) {
  const ttlMs = Math.max(Number(env.placeBoundsCacheTtlMs) || 30000, 1000);
  const maxEntries = Math.max(Number(env.placeBoundsCacheMaxEntries) || 400, 20);
  const key = placeBoundsCacheKey(args);
  const now = Date.now();
  const cached = placeBoundsCache.get(key);

  if (cached && cached.expiresAt > now) {
    placeBoundsCache.delete(key);
    placeBoundsCache.set(key, cached);
    return { items: cached.items, cacheStatus: 'HIT' };
  }

  if (cached) placeBoundsCache.delete(key);

  const items = await getPlacesInBounds(args);
  placeBoundsCache.set(key, { items, expiresAt: now + ttlMs });

  while (placeBoundsCache.size > maxEntries) {
    const oldestKey = placeBoundsCache.keys().next().value;
    if (oldestKey === undefined) break;
    placeBoundsCache.delete(oldestKey);
  }

  return { items, cacheStatus: 'MISS' };
}

function addDiscoveryFilters({ conditions, params, q, category, minRating }) {
  let searchRef = null;

  if (q && String(q).trim()) {
    params.push(String(q).trim());
    searchRef = '$' + params.length;
    const foldedQuery = 'lower(public.hola_unaccent(' + searchRef + '))';

    conditions.push(
      '(' +
      PLACE_SEARCH_TEXT_SQL + " LIKE '%' || " + foldedQuery + " || '%'" +
      ' OR ' + CATEGORY_SEARCH_SQL + " LIKE '%' || " + foldedQuery + " || '%'" +
      ' OR word_similarity(' + foldedQuery + ', ' + PLACE_SEARCH_TEXT_SQL + ') >= 0.42' +
      ' OR similarity(' + PLACE_NAME_SEARCH_SQL + ', ' + foldedQuery + ') >= 0.28' +
      ')'
    );
  }

  if (category && category !== 'all') {
    params.push(category);
    conditions.push('c.slug = $' + params.length);
  }

  if (minRating !== undefined && minRating !== null && minRating !== '') {
    params.push(Number(minRating));
    conditions.push('p.rating_avg >= $' + params.length);
  }

  return { searchRef };
}

export async function generateUniqueSlug(name, client = pool) {
  const base = slugify(name) || 'dia-diem';
  let candidate = base;

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const { rows } = await client.query(
      'SELECT 1 FROM places WHERE slug = $1 LIMIT 1',
      [candidate]
    );
    if (!rows.length) return candidate;
    candidate = base + '-' + (attempt + 1);
  }

  return base + '-' + Date.now();
}

export async function listPlaces({
  q,
  category,
  minRating,
  status = 'PUBLISHED',
  limit = 50,
  offset = 0
} = {}) {
  const conditions = [
    'p.status = $1',
    'ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))'
  ];
  const params = [status, SERVICE_AREA_GEOJSON_STRING];

  const { searchRef } = addDiscoveryFilters({
    conditions,
    params,
    q,
    category,
    minRating
  });

  params.push(Math.min(Number(limit) || 50, 100));
  const limitRef = '$' + params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetRef = '$' + params.length;

  const searchOrder = searchRef
    ? 'GREATEST(' +
      'similarity(' + PLACE_NAME_SEARCH_SQL + ', lower(public.hola_unaccent(' + searchRef + '))), ' +
      'word_similarity(lower(public.hola_unaccent(' + searchRef + ')), ' + PLACE_SEARCH_TEXT_SQL + ')' +
      ') DESC, '
    : '';

  const sql = BASE_SELECT +
    ' WHERE ' + conditions.join(' AND ') +
    ' ORDER BY ' + searchOrder +
    'p.rating_avg DESC, p.rating_count DESC, p.updated_at DESC' +
    ' LIMIT ' + limitRef + ' OFFSET ' + offsetRef;

  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function listHomeSections({ limit = 8 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 16);

  const sql = [
    'WITH ranked AS (',
    '  SELECT',
    '    p.id,',
    '    p.name,',
    '    p.slug,',
    '    p.description,',
    '    p.address,',
    '    p.phone,',
    '    p.website,',
    '    p.price_level,',
    '    p.opening_hours,',
    '    p.status,',
    '    p.source,',
    '    p.created_by,',
    '    p.rating_avg,',
    '    p.rating_count,',
    '    p.created_at,',
    '    p.updated_at,',
    '    ST_X(p.location) AS lng,',
    '    ST_Y(p.location) AS lat,',
    '    c.id AS category_id,',
    '    c.name AS category,',
    '    c.slug AS category_slug,',
    '    c.icon AS category_icon,',
    "    COALESCE(img.images, '[]'::json) AS images,",
    "    COALESCE(img.thumbnails, img.images, '[]'::json) AS thumbnails,",
    "    COALESCE(img.card_images, img.thumbnails, img.images, '[]'::json) AS card_images,",
    '    COALESCE(fav.favorite_count, 0)::int AS favorite_count,',
    '    (COUNT(*) OVER (PARTITION BY c.id))::int AS category_total,',
    '    ROW_NUMBER() OVER (',
    '      PARTITION BY c.id',
    '      ORDER BY',
    '        COALESCE(img.image_count, 0) DESC,',
    '        p.rating_avg DESC,',
    '        p.rating_count DESC,',
    '        COALESCE(fav.favorite_count, 0) DESC,',
    '        p.updated_at DESC',
    '    ) AS category_rank',
    '  FROM places p',
    '  JOIN categories c ON c.id = p.category_id',
    '  LEFT JOIN LATERAL (',
    '    SELECT',
    '      json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC) AS images,',
    '      json_agg(COALESCE(pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC) AS thumbnails,',
    '      json_agg(COALESCE(pi.card_url, pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC) AS card_images,',
    '      COUNT(*)::int AS image_count',
    '    FROM place_images pi',
    '    WHERE pi.place_id = p.id',
    '  ) img ON TRUE',
    '  LEFT JOIN LATERAL (',
    '    SELECT COUNT(*)::int AS favorite_count',
    '    FROM favorites f',
    '    WHERE f.place_id = p.id',
    '  ) fav ON TRUE',
    "  WHERE p.status = 'PUBLISHED'",
    '    AND ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))',
    ')',
    'SELECT *',
    'FROM ranked',
    'WHERE category_rank <= $2',
    'ORDER BY category ASC, category_rank ASC'
  ].join('\n');

  const { rows } = await pool.query(sql, [SERVICE_AREA_GEOJSON_STRING, safeLimit]);
  const sections = [];
  const bySlug = new Map();

  for (const row of rows) {
    let section = bySlug.get(row.category_slug);

    if (!section) {
      section = {
        category: {
          id: row.category_id,
          name: row.category,
          slug: row.category_slug,
          icon: row.category_icon,
          totalCount: Number(row.category_total) || 0
        },
        items: []
      };
      bySlug.set(row.category_slug, section);
      sections.push(section);
    }

    section.items.push(mapRow(row));
  }

  return sections;
}

export async function listFeaturedPlaces({ limit = 4 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 4, 1), 12);

  // In Hola Maps, PUBLISHED is the public/approved state for places.
  // Contributions use APPROVED, but once accepted the resulting place is published.
  const sql = [
    'SELECT',
    '  p.id,',
    '  p.name,',
    '  p.slug,',
    '  p.description,',
    '  p.address,',
    '  p.phone,',
    '  p.website,',
    '  p.price_level,',
    '  p.opening_hours,',
    '  p.status,',
    '  p.source,',
    '  p.created_by,',
    '  p.rating_avg,',
    '  p.rating_count,',
    '  p.created_at,',
    '  p.updated_at,',
    '  ST_X(p.location) AS lng,',
    '  ST_Y(p.location) AS lat,',
    '  c.name AS category,',
    '  c.slug AS category_slug,',
    "  COALESCE(img.images, '[]'::json) AS images,",
    "  COALESCE(img.thumbnails, img.images, '[]'::json) AS thumbnails,",
    "  COALESCE(img.card_images, img.thumbnails, img.images, '[]'::json) AS card_images,",
    '  COALESCE(fav.favorite_count, 0)::int AS favorite_count,',
    '  (',
    '    COALESCE(p.rating_avg, 0) * 20',
    '    + LN(1 + COALESCE(p.rating_count, 0)) * 8',
    '    + LN(1 + COALESCE(fav.favorite_count, 0)) * 6',
    '  ) AS featured_score',
    'FROM places p',
    'LEFT JOIN categories c ON c.id = p.category_id',
    'LEFT JOIN LATERAL (',
    '  SELECT',
    '    json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC) AS images,',
    '    json_agg(COALESCE(pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC) AS thumbnails,',
    '    json_agg(COALESCE(pi.card_url, pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC) AS card_images,',
    '    COUNT(*)::int AS image_count',
    '  FROM place_images pi',
    '  WHERE pi.place_id = p.id',
    ') img ON TRUE',
    'LEFT JOIN LATERAL (',
    '  SELECT COUNT(*)::int AS favorite_count',
    '  FROM favorites f',
    '  WHERE f.place_id = p.id',
    ') fav ON TRUE',
    "WHERE p.status = 'PUBLISHED'",
    '  AND ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))',
    'ORDER BY',
    '  CASE WHEN COALESCE(img.image_count, 0) > 0 THEN 1 ELSE 0 END DESC,',
    '  featured_score DESC,',
    '  p.rating_count DESC,',
    '  p.updated_at DESC',
    'LIMIT $2'
  ].join('\n');

  const { rows } = await pool.query(sql, [SERVICE_AREA_GEOJSON_STRING, safeLimit]);
  return rows.map(mapRow);
}

export async function getPlaceById(id, client = pool) {
  const sql = BASE_SELECT +
    ' WHERE p.id = $1' +
    ' AND ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))';

  const { rows } = await client.query(sql, [id, SERVICE_AREA_GEOJSON_STRING]);
  return mapRow(rows[0]);
}

export async function getPlaceBySlug(slug, client = pool) {
  const sql = BASE_SELECT +
    ' WHERE p.slug = $1' +
    ' AND ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))';

  const { rows } = await client.query(sql, [slug, SERVICE_AREA_GEOJSON_STRING]);
  return mapRow(rows[0]);
}

export async function getNearbyPlaces({
  lat,
  lng,
  radius = 5000,
  status = 'PUBLISHED',
  category,
  minRating
}) {
  const selectWithDistance = BASE_SELECT.replace(
    'FROM places p',
    [
      ', ST_Distance(',
      '    p.location::geography,',
      '    ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography',
      '  ) AS distance_m',
      'FROM places p'
    ].join('\n')
  );

  const conditions = [
    'p.status = $3',
    'ST_DWithin(' +
      'p.location::geography,' +
      'ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,' +
      '$4' +
    ')',
    'ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))'
  ];
  const params = [
    Number(lat),
    Number(lng),
    status,
    Math.min(Math.max(Number(radius) || 5000, 100), 50000),
    SERVICE_AREA_GEOJSON_STRING
  ];

  addDiscoveryFilters({ conditions, params, category, minRating });

  const sql = selectWithDistance +
    ' WHERE ' + conditions.join(' AND ') +
    ' ORDER BY distance_m ASC, p.rating_avg DESC' +
    ' LIMIT 100';

  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function getPlacesInBounds({
  north,
  south,
  east,
  west,
  status = 'PUBLISHED',
  category,
  minRating
}) {
  const conditions = [
    'p.status = $1',
    'p.location && ST_MakeEnvelope($2, $3, $4, $5, 4326)',
    'ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))'
  ];
  const params = [
    status,
    Number(west),
    Number(south),
    Number(east),
    Number(north),
    SERVICE_AREA_GEOJSON_STRING
  ];

  addDiscoveryFilters({ conditions, params, category, minRating });

  const sql = BASE_SELECT +
    ' WHERE ' + conditions.join(' AND ') +
    ' ORDER BY p.rating_avg DESC, p.updated_at DESC' +
    ' LIMIT 200';

  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function createPlace(data, client = pool) {
  if (!isInsideServiceCoverage(data.lng, data.lat)) {
    throw new AppError('Place is outside the Hola Maps service area.', 400);
  }

  const slug = await generateUniqueSlug(data.name, client);

  const { rows } = await client.query(
    `INSERT INTO places (
       name, slug, description, category_id, address, location, phone, website,
       price_level, opening_hours, status, source, created_by
     )
     VALUES (
       $1, $2, $3, $4, $5,
       ST_SetSRID(ST_MakePoint($6, $7), 4326),
       $8, $9, $10, $11, $12, $13, $14
     )
     RETURNING id`,
    [
      data.name,
      slug,
      data.description || null,
      data.categoryId || null,
      data.address || null,
      Number(data.lng),
      Number(data.lat),
      data.phone || null,
      data.website || null,
      data.priceLevel || null,
      data.openingHours || null,
      data.status || 'PENDING',
      data.source || 'USER',
      data.createdBy || null
    ]
  );

  invalidatePlaceBoundsCache();
  return rows[0].id;
}

export async function updatePlaceFields(placeId, fields, client = pool) {
  const allowed = new Set([
    'name',
    'description',
    'address',
    'phone',
    'website',
    'price_level',
    'opening_hours',
    'category_id',
    'status'
  ]);

  const clauses = [];
  const params = [];

  for (const [key, value] of Object.entries(fields || {})) {
    if (!allowed.has(key)) continue;
    params.push(value);
    clauses.push(key + ' = $' + params.length);
  }

  if (!clauses.length) return false;

  params.push(placeId);
  await client.query(
    'UPDATE places SET ' +
      clauses.join(', ') +
      ', updated_at = NOW() WHERE id = $' + params.length,
    params
  );
  invalidatePlaceBoundsCache();
  return true;
}

export async function updatePlaceLocation(placeId, lat, lng, client = pool) {
  if (!isInsideServiceCoverage(lng, lat)) {
    throw new AppError('Place is outside the Hola Maps service area.', 400);
  }

  await client.query(
    `UPDATE places
     SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
         updated_at = NOW()
     WHERE id = $3`,
    [Number(lng), Number(lat), placeId]
  );
  invalidatePlaceBoundsCache();
}

async function placeHasCover(placeId, client) {
  const { rows } = await client.query(
    'SELECT 1 FROM place_images WHERE place_id = $1 AND is_cover = TRUE LIMIT 1',
    [placeId]
  );
  return rows.length > 0;
}

export async function addPlaceImages(placeId, urls, uploadedBy, client = pool) {
  if (!Array.isArray(urls) || !urls.length) return;

  let assignCover = !(await placeHasCover(placeId, client));

  for (const url of urls) {
    await client.query(
      `INSERT INTO place_images (place_id, url, uploaded_by, is_cover)
       VALUES ($1, $2, $3, $4)`,
      [placeId, url, uploadedBy || null, assignCover]
    );
    assignCover = false;
  }
  invalidatePlaceBoundsCache();
}

export async function addPlaceImageAssets(placeId, assets, uploadedBy, client = pool) {
  if (!Array.isArray(assets) || !assets.length) return;

  let assignCover = !(await placeHasCover(placeId, client));

  for (const asset of assets) {
    await client.query(
      `INSERT INTO place_images (
         place_id, url, uploaded_by, is_cover,
         storage_provider, storage_public_id, storage_asset_folder,
         thumbnail_url, card_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        placeId,
        asset.url,
        uploadedBy || null,
        assignCover,
        asset.provider || null,
        asset.publicId || asset.filename || null,
        asset.assetFolder || null,
        asset.thumbnailUrl || asset.url || null,
        asset.cardUrl || asset.thumbnailUrl || asset.url || null
      ]
    );
    assignCover = false;
  }
  invalidatePlaceBoundsCache();
}

export async function listAdminPlaces({
  q,
  status = 'ALL',
  limit = 50,
  offset = 0
} = {}) {
  const conditions = [
    'ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))'
  ];
  const params = [SERVICE_AREA_GEOJSON_STRING];

  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('p.status = $' + params.length);
  }

  let searchRef = null;
  if (q && String(q).trim()) {
    params.push(String(q).trim());
    searchRef = '$' + params.length;
    const foldedQuery = 'lower(public.hola_unaccent(' + searchRef + '))';
    conditions.push(
      '(' +
      PLACE_SEARCH_TEXT_SQL + " LIKE '%' || " + foldedQuery + " || '%'" +
      ' OR word_similarity(' + foldedQuery + ', ' + PLACE_SEARCH_TEXT_SQL + ') >= 0.42' +
      ' OR similarity(' + PLACE_NAME_SEARCH_SQL + ', ' + foldedQuery + ') >= 0.28' +
      ')'
    );
  }

  params.push(Math.min(Number(limit) || 50, 100));
  const limitRef = '$' + params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetRef = '$' + params.length;

  const adminSearchOrder = searchRef
    ? 'GREATEST(' +
      'similarity(' + PLACE_NAME_SEARCH_SQL + ', lower(public.hola_unaccent(' + searchRef + '))), ' +
      'word_similarity(lower(public.hola_unaccent(' + searchRef + ')), ' + PLACE_SEARCH_TEXT_SQL + ')' +
      ') DESC, '
    : '';

  const sql = BASE_SELECT +
    ' WHERE ' + conditions.join(' AND ') +
    ' ORDER BY ' + adminSearchOrder + 'p.updated_at DESC' +
    ' LIMIT ' + limitRef + ' OFFSET ' + offsetRef;

  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function getAdminPlaceImages(placeId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       id, place_id, url, thumbnail_url, card_url, is_cover, uploaded_by, created_at,
       storage_provider, storage_public_id, storage_asset_folder
     FROM place_images
     WHERE place_id = $1
     ORDER BY is_cover DESC, id ASC`,
    [placeId]
  );

  return rows.map((row) => ({
    id: row.id,
    placeId: row.place_id,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || row.url,
    cardUrl: row.card_url || row.thumbnail_url || row.url,
    isCover: row.is_cover,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    storageProvider: row.storage_provider,
    storagePublicId: row.storage_public_id,
    storageAssetFolder: row.storage_asset_folder
  }));
}

export async function setPlaceImageCover(placeId, imageId, client = pool) {
  const { rows } = await client.query(
    'SELECT id FROM place_images WHERE id = $1 AND place_id = $2',
    [imageId, placeId]
  );
  if (!rows[0]) throw new AppError('Place image not found.', 404);

  // Two-step update avoids transient conflicts with the partial unique index
  // that guarantees one cover image per place.
  await client.query(
    'UPDATE place_images SET is_cover = FALSE WHERE place_id = $1',
    [placeId]
  );
  await client.query(
    'UPDATE place_images SET is_cover = TRUE WHERE id = $1 AND place_id = $2',
    [imageId, placeId]
  );
  invalidatePlaceBoundsCache();
}

export async function removePlaceImage(placeId, imageId, client = pool) {
  const { rows } = await client.query(
    `DELETE FROM place_images
     WHERE id = $1 AND place_id = $2
     RETURNING
       id, url, thumbnail_url, card_url, is_cover,
       storage_provider, storage_public_id, storage_asset_folder`,
    [imageId, placeId]
  );

  const removed = rows[0];
  if (!removed) throw new AppError('Place image not found.', 404);

  if (removed.is_cover) {
    await client.query(
      `UPDATE place_images
       SET is_cover = TRUE
       WHERE id = (
         SELECT id
         FROM place_images
         WHERE place_id = $1
         ORDER BY id ASC
         LIMIT 1
       )`,
      [placeId]
    );
  }

  invalidatePlaceBoundsCache();

  const filenameFromUrl = (value) => {
    if (!value) return undefined;
    try {
      return decodeURIComponent(new URL(value).pathname.split('/').pop() || '') || undefined;
    } catch {
      return undefined;
    }
  };

  return {
    id: removed.id,
    url: removed.url,
    thumbnailUrl: removed.thumbnail_url || null,
    cardUrl: removed.card_url || null,
    provider: removed.storage_provider,
    publicId: removed.storage_public_id,
    filename: removed.storage_provider === 'local'
      ? removed.storage_public_id
      : undefined,
    thumbnailFilename: removed.storage_provider === 'local'
      ? filenameFromUrl(removed.thumbnail_url)
      : undefined,
    cardFilename: removed.storage_provider === 'local'
      ? filenameFromUrl(removed.card_url)
      : undefined,
    assetFolder: removed.storage_asset_folder
  };}

export async function listPublishedPlacesByUser(userId, { limit = 100 } = {}, client = pool) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);

  const { rows } = await client.query(
    `SELECT
       p.id,
       p.name,
       p.address,
       p.rating_avg,
       p.rating_count,
       ST_X(p.location) AS lng,
       ST_Y(p.location) AS lat,
       c.name AS category,
       c.slug AS category_slug,
       COALESCE((
         SELECT COALESCE(pi.thumbnail_url, pi.url)
         FROM place_images pi
         WHERE pi.place_id = p.id
         ORDER BY pi.is_cover DESC, pi.id ASC
         LIMIT 1
       ), '') AS cover_image,
       (
         SELECT COUNT(*)::int
         FROM place_images pi
         WHERE pi.place_id = p.id
       ) AS image_count,
       p.created_at
     FROM places p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.created_by = $1
       AND p.status = 'PUBLISHED'
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    address: row.address,
    category: row.category || 'Địa điểm',
    categorySlug: row.category_slug || 'other',
    rating: Number(row.rating_avg) || 0,
    reviews: Number(row.rating_count) || 0,
    lat: Number(row.lat),
    lng: Number(row.lng),
    coverImage: row.cover_image || null,
    imageCount: Number(row.image_count) || 0,
    createdAt: row.created_at
  }));
}

export async function listPhotosByUser(userId, { limit = 120 } = {}, client = pool) {
  const safeLimit = Math.min(Math.max(Number(limit) || 120, 1), 240);

  const { rows } = await client.query(
    `SELECT
       pi.id,
       pi.url,
       pi.is_cover,
       pi.created_at,
       p.id AS place_id,
       p.name AS place_name,
       p.address AS place_address,
       ST_X(p.location) AS lng,
       ST_Y(p.location) AS lat,
       c.name AS category
     FROM place_images pi
     JOIN places p ON p.id = pi.place_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE pi.uploaded_by = $1
       AND p.status = 'PUBLISHED'
     ORDER BY pi.created_at DESC, pi.id DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return rows.map((row) => ({
    id: String(row.id),
    url: row.url,
    isCover: Boolean(row.is_cover),
    createdAt: row.created_at,
    placeId: String(row.place_id),
    placeName: row.place_name,
    placeAddress: row.place_address,
    category: row.category || 'Địa điểm',
    lat: Number(row.lat),
    lng: Number(row.lng)
  }));
}

export async function countPublishedPlacesByUser(userId, client = pool) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS count FROM places WHERE created_by = $1 AND status = 'PUBLISHED'",
    [userId]
  );
  return rows[0]?.count || 0;
}

export async function countPhotosByUser(userId, client = pool) {
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM place_images WHERE uploaded_by = $1',
    [userId]
  );
  return rows[0]?.count || 0;
}
