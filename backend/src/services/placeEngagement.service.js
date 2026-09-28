import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

async function ensurePublishedPlace(placeId, client = pool) {
  const { rows } = await client.query(
    "SELECT id FROM places WHERE id = $1 AND status = 'PUBLISHED'",
    [placeId]
  );
  if (!rows[0]) throw new AppError('Place not found.', 404);
}

async function refreshPlaceRating(placeId, client) {
  const { rows } = await client.query(
    `SELECT
       COALESCE(AVG(rating), 0)::numeric(3,2) AS avg,
       COUNT(*)::int AS count
     FROM reviews
     WHERE place_id = $1`,
    [placeId]
  );

  await client.query(
    `UPDATE places
     SET rating_avg = $1,
         rating_count = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [rows[0].avg, rows[0].count, placeId]
  );
}

export async function listPlaceReviews(placeId, { limit = 30, offset = 0 } = {}) {
  await ensurePublishedPlace(placeId);

  const { rows } = await pool.query(
    `SELECT
       r.id, r.rating, r.comment, r.created_at, r.updated_at,
       u.id AS user_id, u.name AS user_name, u.avatar_url
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.place_id = $1
     ORDER BY r.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [placeId, Math.min(Number(limit) || 30, 100), Number(offset) || 0]
  );

  return rows.map((row) => ({
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      avatarUrl: row.avatar_url
    }
  }));
}

export async function getMyReview(placeId, userId) {
  const { rows } = await pool.query(
    `SELECT id, rating, comment, created_at, updated_at
     FROM reviews
     WHERE place_id = $1 AND user_id = $2`,
    [placeId, userId]
  );

  const row = rows[0];
  return row ? {
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null;
}

export async function upsertReview({ placeId, userId, rating, comment }) {
  return withTransaction(async (client) => {
    await ensurePublishedPlace(placeId, client);

    const { rows } = await client.query(
      `INSERT INTO reviews (place_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (place_id, user_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         updated_at = NOW()
       RETURNING id, rating, comment, created_at, updated_at`,
      [placeId, userId, rating, comment || null]
    );

    await refreshPlaceRating(placeId, client);

    return {
      id: rows[0].id,
      rating: Number(rows[0].rating),
      comment: rows[0].comment,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };
  });
}

export async function deleteReview(placeId, userId) {
  return withTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM reviews WHERE place_id = $1 AND user_id = $2',
      [placeId, userId]
    );

    await refreshPlaceRating(placeId, client);
    return result.rowCount > 0;
  });
}

export async function getFavoriteState(placeId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM favorites WHERE place_id = $1 AND user_id = $2',
    [placeId, userId]
  );
  return rows.length > 0;
}

export async function addFavorite(placeId, userId) {
  await ensurePublishedPlace(placeId);
  await pool.query(
    `INSERT INTO favorites (user_id, place_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, place_id) DO NOTHING`,
    [userId, placeId]
  );
  return true;
}

export async function removeFavorite(placeId, userId) {
  await pool.query(
    'DELETE FROM favorites WHERE user_id = $1 AND place_id = $2',
    [userId, placeId]
  );
  return false;
}

export async function listFavorites(userId) {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.name, p.slug, p.description, p.address,
       p.price_level, p.opening_hours, p.rating_avg, p.rating_count,
       ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
       c.name AS category, c.slug AS category_slug,
       COALESCE(
         (SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC)
          FROM place_images pi WHERE pi.place_id = p.id),
         '[]'::json
       ) AS images,
       f.created_at AS saved_at
     FROM favorites f
     JOIN places p ON p.id = f.place_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE f.user_id = $1 AND p.status = 'PUBLISHED'
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    address: row.address,
    priceLevel: row.price_level,
    openingHours: row.opening_hours,
    rating: Number(row.rating_avg) || 0,
    reviews: row.rating_count || 0,
    lng: Number(row.lng),
    lat: Number(row.lat),
    category: row.category,
    categorySlug: row.category_slug,
    images: row.images || [],
    savedAt: row.saved_at
  }));
}
