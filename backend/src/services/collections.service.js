import { randomBytes } from 'node:crypto';
import { pool, withTransaction } from '../database/pool.js';
import { slugify } from '../utils/slugify.js';
import { AppError } from '../utils/AppError.js';

const COLLECTION_LIMIT = 100;

const COLLECTION_SELECT = `
  SELECT
    c.id,
    c.user_id,
    c.title,
    c.slug,
    c.description,
    c.visibility,
    c.created_at,
    c.updated_at,
    u.name AS owner_name,
    u.avatar_url AS owner_avatar_url,
    (
      SELECT COUNT(*)::int
      FROM collection_places cp
      JOIN places p ON p.id = cp.place_id AND p.status = 'PUBLISHED'
      WHERE cp.collection_id = c.id
    ) AS place_count,
    (
      SELECT COALESCE(pi.card_url, pi.thumbnail_url, pi.url)
      FROM collection_places cp
      JOIN places p ON p.id = cp.place_id AND p.status = 'PUBLISHED'
      LEFT JOIN place_images pi ON pi.place_id = p.id
      WHERE cp.collection_id = c.id
      ORDER BY cp.position ASC, cp.created_at ASC, pi.is_cover DESC NULLS LAST, pi.id ASC
      LIMIT 1
    ) AS cover_image
  FROM place_collections c
  JOIN users u ON u.id = c.user_id
`;

function mapCollection(row, places = undefined) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    description: row.description || '',
    visibility: row.visibility,
    isPublic: row.visibility === 'PUBLIC',
    placeCount: Number(row.place_count) || 0,
    coverImage: row.cover_image || null,
    owner: row.owner_name ? {
      name: row.owner_name,
      avatarUrl: row.owner_avatar_url || null
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(places === undefined ? {} : { places })
  };
}

async function getOwnedCollectionRow(collectionId, userId, client = pool) {
  const { rows } = await client.query(
    COLLECTION_SELECT + ' WHERE c.id = $1 AND c.user_id = $2 LIMIT 1',
    [collectionId, userId]
  );
  if (!rows[0]) throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền truy cập.', 404);
  return rows[0];
}

async function listCollectionPlaces(collectionId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       p.id,
       p.name,
       p.slug,
       p.description,
       p.address,
       p.phone,
       p.website,
       p.price_level,
       p.opening_hours,
       p.rating_avg,
       p.rating_count,
       ST_X(p.location) AS lng,
       ST_Y(p.location) AS lat,
       c.name AS category,
       c.slug AS category_slug,
       cp.position,
       COALESCE(
         (SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC)
          FROM place_images pi WHERE pi.place_id = p.id),
         '[]'::json
       ) AS images,
       (SELECT COALESCE(pi.card_url, pi.thumbnail_url, pi.url)
        FROM place_images pi
        WHERE pi.place_id = p.id
        ORDER BY pi.is_cover DESC, pi.id ASC
        LIMIT 1) AS cover_image
     FROM collection_places cp
     JOIN places p ON p.id = cp.place_id AND p.status = 'PUBLISHED'
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE cp.collection_id = $1
     ORDER BY cp.position ASC, cp.created_at ASC`,
    [collectionId]
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    address: row.address || 'Hòa Lạc, Hà Nội',
    phone: row.phone || null,
    website: row.website || null,
    priceLevel: row.price_level || null,
    openingHours: row.opening_hours || null,
    rating: Number(row.rating_avg) || 0,
    reviews: Number(row.rating_count) || 0,
    lat: Number(row.lat),
    lng: Number(row.lng),
    category: row.category || 'Địa điểm',
    categorySlug: row.category_slug || null,
    position: Number(row.position) || 0,
    images: row.images || [],
    coverImage: row.cover_image || null
  }));
}

export async function listMyCollections(userId) {
  const { rows } = await pool.query(
    COLLECTION_SELECT + ' WHERE c.user_id = $1 ORDER BY c.updated_at DESC, c.id DESC',
    [userId]
  );
  return rows.map((row) => mapCollection(row));
}

export async function getMyCollection(collectionId, userId) {
  const row = await getOwnedCollectionRow(collectionId, userId);
  const places = await listCollectionPlaces(collectionId);
  return mapCollection(row, places);
}

export async function getPublicCollection(slug) {
  const { rows } = await pool.query(
    COLLECTION_SELECT + " WHERE c.slug = $1 AND c.visibility = 'PUBLIC' LIMIT 1",
    [slug]
  );
  if (!rows[0]) return null;
  const places = await listCollectionPlaces(rows[0].id);
  return mapCollection(rows[0], places);
}

export async function createCollection({ userId, title, description = '', visibility = 'PRIVATE' }) {
  const baseSlug = slugify(title) || 'bo-suu-tap';
  const slug = baseSlug + '-' + randomBytes(6).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO place_collections (user_id, title, slug, description, visibility)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, title.trim(), slug, description.trim(), visibility]
  );
  return getMyCollection(rows[0].id, userId);
}

export async function updateCollection(collectionId, userId, payload) {
  const fields = [];
  const values = [collectionId, userId];

  if (payload.title !== undefined) {
    values.push(payload.title.trim());
    fields.push('title = $' + values.length);
  }
  if (payload.description !== undefined) {
    values.push(payload.description.trim());
    fields.push('description = $' + values.length);
  }
  if (payload.visibility !== undefined) {
    values.push(payload.visibility);
    fields.push('visibility = $' + values.length);
  }

  if (!fields.length) throw new AppError('Không có nội dung nào để cập nhật.', 400);

  const { rowCount } = await pool.query(
    `UPDATE place_collections
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    values
  );
  if (!rowCount) throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền truy cập.', 404);
  return getMyCollection(collectionId, userId);
}

export async function deleteCollection(collectionId, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM place_collections WHERE id = $1 AND user_id = $2',
    [collectionId, userId]
  );
  if (!rowCount) throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền truy cập.', 404);
  return true;
}

export async function addPlaceToCollection(collectionId, userId, placeId) {
  return withTransaction(async (client) => {
    const lockedCollection = await client.query(
      'SELECT id FROM place_collections WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [collectionId, userId]
    );
    if (!lockedCollection.rows[0]) {
      throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền truy cập.', 404);
    }

    const place = await client.query(
      "SELECT id FROM places WHERE id = $1 AND status = 'PUBLISHED' LIMIT 1",
      [placeId]
    );
    if (!place.rows[0]) throw new AppError('Địa điểm không tồn tại hoặc chưa được xuất bản.', 404);

    const existing = await client.query(
      'SELECT 1 FROM collection_places WHERE collection_id = $1 AND place_id = $2',
      [collectionId, placeId]
    );
    if (existing.rows.length) return true;

    const count = await client.query(
      'SELECT COUNT(*)::int AS total FROM collection_places WHERE collection_id = $1',
      [collectionId]
    );
    if (Number(count.rows[0]?.total || 0) >= COLLECTION_LIMIT) {
      throw new AppError('Mỗi bộ sưu tập tối đa 100 địa điểm.', 400);
    }

    await client.query(
      `INSERT INTO collection_places (collection_id, place_id, position)
       SELECT $1, $2, COALESCE(MAX(position), -1) + 1
       FROM collection_places
       WHERE collection_id = $1`,
      [collectionId, placeId]
    );
    await client.query(
      'UPDATE place_collections SET updated_at = NOW() WHERE id = $1',
      [collectionId]
    );
    return true;
  });
}

export async function removePlaceFromCollection(collectionId, userId, placeId) {
  return withTransaction(async (client) => {
    const lockedCollection = await client.query(
      'SELECT id FROM place_collections WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [collectionId, userId]
    );
    if (!lockedCollection.rows[0]) {
      throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền truy cập.', 404);
    }
    await client.query(
      'DELETE FROM collection_places WHERE collection_id = $1 AND place_id = $2',
      [collectionId, placeId]
    );
    await client.query(
      'UPDATE collection_places SET position = position + 10000 WHERE collection_id = $1',
      [collectionId]
    );
    await client.query(
      `WITH ordered AS (
         SELECT place_id,
                ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC) - 1 AS next_position
         FROM collection_places
         WHERE collection_id = $1
       )
       UPDATE collection_places cp
       SET position = ordered.next_position
       FROM ordered
       WHERE cp.collection_id = $1 AND cp.place_id = ordered.place_id`,
      [collectionId]
    );
    await client.query(
      'UPDATE place_collections SET updated_at = NOW() WHERE id = $1',
      [collectionId]
    );
    return true;
  });
}

export async function replaceCollectionPlaces(collectionId, userId, placeIds = []) {
  if (!Array.isArray(placeIds) || placeIds.length > COLLECTION_LIMIT) {
    throw new AppError('Mỗi bộ sưu tập tối đa 100 địa điểm.', 400);
  }

  const normalizedIds = placeIds.map(Number);
  if (normalizedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new AppError('Danh sách địa điểm không hợp lệ.', 400);
  }
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new AppError('Một địa điểm không thể xuất hiện hai lần trong bộ sưu tập.', 400);
  }

  return withTransaction(async (client) => {
    const lockedCollection = await client.query(
      'SELECT id FROM place_collections WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [collectionId, userId]
    );
    if (!lockedCollection.rows[0]) {
      throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền truy cập.', 404);
    }

    if (normalizedIds.length) {
      const { rows } = await client.query(
        "SELECT id FROM places WHERE id = ANY($1::bigint[]) AND status = 'PUBLISHED'",
        [normalizedIds]
      );
      if (rows.length !== normalizedIds.length) {
        throw new AppError('Có địa điểm không tồn tại hoặc chưa được xuất bản.', 400);
      }
    }

    await client.query(
      'DELETE FROM collection_places WHERE collection_id = $1',
      [collectionId]
    );

    if (normalizedIds.length) {
      await client.query(
        `INSERT INTO collection_places (collection_id, place_id, position)
         SELECT $1, value, ordinality::int - 1
         FROM unnest($2::bigint[]) WITH ORDINALITY AS input(value, ordinality)`,
        [collectionId, normalizedIds]
      );
    }

    await client.query(
      'UPDATE place_collections SET updated_at = NOW() WHERE id = $1',
      [collectionId]
    );

    const row = await getOwnedCollectionRow(collectionId, userId, client);
    const places = await listCollectionPlaces(collectionId, client);
    return mapCollection(row, places);
  });
}
