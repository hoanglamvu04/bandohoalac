import { pool } from '../database/pool.js';
import { slugify } from '../utils/slugify.js';

const BASE_SELECT = `
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.address,
    p.phone,
    p.website,
    p.price_level,
    p.opening_hours,
    p.status,
    p.source,
    p.created_by,
    p.rating_avg,
    p.rating_count,
    p.created_at,
    p.updated_at,
    ST_X(p.location) AS lng,
    ST_Y(p.location) AS lat,
    c.name AS category,
    c.slug AS category_slug,
    COALESCE(
      (SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC)
       FROM place_images pi WHERE pi.place_id = p.id),
      '[]'::json
    ) AS images
  FROM places p
  LEFT JOIN categories c ON c.id = p.category_id
`;

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
    reviews: row.rating_count || 0,
    lat: Number(row.lat),
    lng: Number(row.lng),
    category: row.category,
    categorySlug: row.category_slug,
    images: row.images || [],
    distance: row.distance_m !== undefined ? Math.round(Number(row.distance_m)) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function generateUniqueSlug(name, client = pool) {
  const base = slugify(name) || 'dia-diem';
  let candidate = base;
  let attempt = 1;

  while (attempt < 50) {
    const { rows } = await client.query('SELECT 1 FROM places WHERE slug = $1', [candidate]);
    if (rows.length === 0) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${Date.now()}`;
}

export async function listPlaces({ q, category, status = 'PUBLISHED', limit = 50, offset = 0 } = {}) {
  const conditions = ['p.status = $1'];
  const params = [status];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.address ILIKE $${params.length})`);
  }

  if (category && category !== 'all') {
    params.push(category);
    conditions.push(`c.slug = $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 50, 100));
  params.push(Number(offset) || 0);

  const sql = `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function getPlaceById(id) {
  const { rows } = await pool.query(`${BASE_SELECT} WHERE p.id = $1`, [id]);
  return mapRow(rows[0]);
}

export async function getPlaceBySlug(slug) {
  const { rows } = await pool.query(`${BASE_SELECT} WHERE p.slug = $1`, [slug]);
  return mapRow(rows[0]);
}

export async function getNearbyPlaces({ lat, lng, radius = 5000, status = 'PUBLISHED' }) {
  const sql = `
    ${BASE_SELECT.replace(
      'FROM places p',
      'FROM places p'
    )}, ST_Distance(p.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_m
    WHERE p.status = $3
      AND ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4)
    ORDER BY distance_m ASC
    LIMIT 100
  `;
  const { rows } = await pool.query(sql, [lat, lng, status, radius]);
  return rows.map(mapRow);
}

export async function getPlacesInBounds({ north, south, east, west, status = 'PUBLISHED' }) {
  const sql = `
    ${BASE_SELECT}
    WHERE p.status = $1
      AND p.location && ST_MakeEnvelope($2, $3, $4, $5, 4326)
    LIMIT 200
  `;
  const { rows } = await pool.query(sql, [status, west, south, east, north]);
  return rows.map(mapRow);
}

export async function createPlace(data, client = pool) {
  const slug = await generateUniqueSlug(data.name, client);
  const { rows } = await client.query(
    `INSERT INTO places (
       name, slug, description, category_id, address, location, phone, website,
       price_level, opening_hours, status, source, created_by
     ) VALUES (
       $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9,
       $10, $11, $12, $13, $14
     ) RETURNING id`,
    [
      data.name, slug, data.description || null, data.categoryId || null, data.address || null,
      data.lng, data.lat, data.phone || null, data.website || null,
      data.priceLevel || null, data.openingHours || null, data.status || 'PENDING',
      data.source || 'USER', data.createdBy || null
    ]
  );
  return rows[0].id;
}

export async function updatePlaceFields(placeId, fields, client = pool) {
  const allowed = ['name', 'description', 'address', 'phone', 'website', 'price_level', 'opening_hours', 'category_id', 'status'];
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    params.push(value);
    setClauses.push(`${key} = $${params.length}`);
  }

  if (setClauses.length === 0) return;

  params.push(placeId);
  await client.query(
    `UPDATE places SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );
}

export async function updatePlaceLocation(placeId, lat, lng, client = pool) {
  await client.query(
    'UPDATE places SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326), updated_at = NOW() WHERE id = $3',
    [lng, lat, placeId]
  );
}

export async function addPlaceImages(placeId, urls, uploadedBy, client = pool) {
  if (!urls.length) return;
  const values = [];
  const params = [];
  urls.forEach((url, index) => {
    params.push(placeId, url, uploadedBy, index === 0);
    values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
  });
  await client.query(
    `INSERT INTO place_images (place_id, url, uploaded_by, is_cover) VALUES ${values.join(', ')}`,
    params
  );
}

export async function countPublishedPlacesByUser(userId, client = pool) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS count FROM places WHERE created_by = $1 AND status = 'PUBLISHED'",
    [userId]
  );
  return rows[0].count;
}

export async function countPhotosByUser(userId, client = pool) {
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM place_images WHERE uploaded_by = $1',
    [userId]
  );
  return rows[0].count;
}
