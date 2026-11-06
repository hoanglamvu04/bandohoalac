import { randomBytes } from 'node:crypto';
import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slugify.js';

function mapCollection(row) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    description: row.description || '',
    visibility: row.visibility,
    itemCount: Number(row.item_count || 0),
    coverImage: row.cover_image || null,
    containsPlace: Boolean(row.contains_place),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: row.owner_id ? {
      id: String(row.owner_id),
      name: row.owner_name || 'Thành viên HOLA',
      avatarUrl: row.owner_avatar_url || null
    } : null
  };
}

const COLLECTION_LIST_SELECT = [
  'SELECT',
  '  pc.id, pc.user_id AS owner_id, pc.title, pc.slug, pc.description,',
  '  pc.visibility, pc.created_at, pc.updated_at,',
  '  u.name AS owner_name, u.avatar_url AS owner_avatar_url,',
  '  (SELECT COUNT(*)::int FROM place_collection_items pci WHERE pci.collection_id = pc.id) AS item_count,',
  '  (',
  '    SELECT COALESCE(pi.card_url, pi.thumbnail_url, pi.url)',
  '    FROM place_collection_items pci',
  '    JOIN place_images pi ON pi.place_id = pci.place_id',
  '    WHERE pci.collection_id = pc.id',
  '    ORDER BY pci.sort_order ASC, pci.created_at ASC, pi.is_cover DESC, pi.id ASC',
  '    LIMIT 1',
  '  ) AS cover_image',
  'FROM place_collections pc',
  'JOIN users u ON u.id = pc.user_id'
].join('\n');

export async function listMyCollections(userId, {
  placeId = null,
  limit = 100,
  offset = 0
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const normalizedPlaceId = Number.isSafeInteger(Number(placeId)) && Number(placeId) > 0
    ? Number(placeId)
    : null;
  const selectWithMembership = COLLECTION_LIST_SELECT.replace(
    'FROM place_collections pc',
    [
      '  , CASE WHEN $2::bigint IS NULL THEN FALSE ELSE EXISTS (',
      '      SELECT 1 FROM place_collection_items pci',
      '      WHERE pci.collection_id = pc.id AND pci.place_id = $2',
      '    ) END AS contains_place',
      'FROM place_collections pc'
    ].join('\n')
  );

  const { rows } = await pool.query(
    selectWithMembership + [
      '',
      'WHERE pc.user_id = $1',
      'ORDER BY pc.updated_at DESC, pc.id DESC',
      'LIMIT $3 OFFSET $4'
    ].join('\n'),
    [userId, normalizedPlaceId, safeLimit, safeOffset]
  );

  return rows.map(mapCollection);
}

export async function listPublicCollections({ limit = 24, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 48);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { rows } = await pool.query(
    COLLECTION_LIST_SELECT + [
      '',
      "WHERE pc.visibility = 'PUBLIC'",
      'ORDER BY pc.updated_at DESC, pc.id DESC',
      'LIMIT $1 OFFSET $2'
    ].join('\n'),
    [safeLimit, safeOffset]
  );

  return rows.map(mapCollection);
}

export async function getCollectionBySlug(slug, viewerId = null) {
  const { rows } = await pool.query(
    COLLECTION_LIST_SELECT + [
      '',
      'WHERE pc.slug = $1',
      "  AND (pc.visibility = 'PUBLIC' OR pc.user_id = $2)",
      'LIMIT 1'
    ].join('\n'),
    [String(slug || '').trim(), viewerId || null]
  );
  const row = rows[0];
  if (!row) throw new AppError('Không tìm thấy bộ sưu tập hoặc bộ sưu tập đang ở chế độ riêng tư.', 404);

  const itemSql = [
    'SELECT',
    '  p.id, p.name, p.slug, p.description, p.address, p.phone, p.website,',
    '  p.price_level, p.opening_hours, p.rating_avg, p.rating_count,',
    '  ST_X(p.location) AS lng, ST_Y(p.location) AS lat,',
    '  c.name AS category, c.slug AS category_slug,',
    '  pci.id AS collection_item_id, pci.sort_order, pci.note,',
    '  pci.created_at AS added_at,',
    "  COALESCE((SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC)",
    "    FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS images,",
    "  COALESCE((SELECT json_agg(COALESCE(pi.card_url, pi.thumbnail_url, pi.url)",
    '    ORDER BY pi.is_cover DESC, pi.id ASC)',
    "    FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS card_images",
    'FROM place_collection_items pci',
    'JOIN places p ON p.id = pci.place_id',
    'LEFT JOIN categories c ON c.id = p.category_id',
    "WHERE pci.collection_id = $1 AND p.status = 'PUBLISHED'",
    'ORDER BY pci.sort_order ASC, pci.created_at ASC, pci.id ASC'
  ].join('\n');
  const { rows: itemRows } = await pool.query(itemSql, [row.id]);

  return {
    collection: mapCollection(row),
    isOwner: Boolean(viewerId && Number(viewerId) === Number(row.owner_id)),
    items: itemRows.map((item) => ({
      id: String(item.id),
      name: item.name,
      slug: item.slug,
      description: item.description,
      address: item.address,
      phone: item.phone,
      website: item.website,
      priceLevel: item.price_level,
      openingHours: item.opening_hours,
      rating: Number(item.rating_avg) || 0,
      reviews: Number(item.rating_count) || 0,
      lng: Number(item.lng),
      lat: Number(item.lat),
      category: item.category || 'Địa điểm',
      categorySlug: item.category_slug || 'other',
      images: Array.isArray(item.images) ? item.images : [],
      cardImages: Array.isArray(item.card_images) ? item.card_images : [],
      collectionItemId: String(item.collection_item_id),
      sortOrder: Number(item.sort_order || 0),
      note: item.note || '',
      addedAt: item.added_at
    }))
  };
}

async function getOwnedCollection(collectionId, userId, client = pool) {
  const { rows } = await client.query(
    'SELECT id, slug FROM place_collections WHERE id = $1 AND user_id = $2 LIMIT 1',
    [collectionId, userId]
  );
  if (!rows[0]) throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền quản lý.', 404);
  return rows[0];
}

export async function createCollection(userId, values = {}) {
  const title = String(values.title || '').trim();
  const description = String(values.description || '').trim();
  const visibility = values.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
  const base = slugify(title) || 'bo-suu-tap';
  const slug = base + '-' + randomBytes(3).toString('hex');

  const { rows } = await pool.query(
    'INSERT INTO place_collections (user_id, title, slug, description, visibility) ' +
    'VALUES ($1, $2, $3, $4, $5) RETURNING id, slug',
    [userId, title, slug, description, visibility]
  );

  return getCollectionBySlug(rows[0].slug, userId);
}

export async function updateCollection(collectionId, userId, values = {}) {
  const owned = await getOwnedCollection(collectionId, userId);
  const columnMap = {
    title: 'title',
    description: 'description',
    visibility: 'visibility'
  };
  const params = [];
  const sets = [];

  for (const [key, column] of Object.entries(columnMap)) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    params.push(values[key]);
    sets.push(column + ' = $' + params.length);
  }

  if (sets.length) {
    sets.push('updated_at = NOW()');
    params.push(collectionId);
    const idRef = '$' + params.length;
    params.push(userId);
    await pool.query(
      'UPDATE place_collections SET ' + sets.join(', ') +
      ' WHERE id = ' + idRef + ' AND user_id = $' + params.length,
      params
    );
  }

  return getCollectionBySlug(owned.slug, userId);
}

export async function deleteCollection(collectionId, userId) {
  const result = await pool.query(
    'DELETE FROM place_collections WHERE id = $1 AND user_id = $2',
    [collectionId, userId]
  );
  if (!result.rowCount) throw new AppError('Không tìm thấy bộ sưu tập hoặc bạn không có quyền quản lý.', 404);
  return true;
}

export async function addPlaceToCollection(collectionId, userId, placeId) {
  return withTransaction(async (client) => {
    await getOwnedCollection(collectionId, userId, client);

    const { rows: places } = await client.query(
      "SELECT id FROM places WHERE id = $1 AND status = 'PUBLISHED' LIMIT 1",
      [placeId]
    );
    if (!places[0]) throw new AppError('Địa điểm không tồn tại hoặc chưa được xuất bản.', 404);

    const { rows: orderRows } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order ' +
      'FROM place_collection_items WHERE collection_id = $1',
      [collectionId]
    );
    const result = await client.query(
      'INSERT INTO place_collection_items (collection_id, place_id, sort_order) ' +
      'VALUES ($1, $2, $3) ON CONFLICT (collection_id, place_id) DO NOTHING RETURNING id',
      [collectionId, placeId, Number(orderRows[0]?.next_order || 0)]
    );

    if (result.rowCount) {
      await client.query('UPDATE place_collections SET updated_at = NOW() WHERE id = $1', [collectionId]);
    }

    return { added: result.rowCount > 0 };
  });
}

export async function removePlaceFromCollection(collectionId, userId, placeId) {
  return withTransaction(async (client) => {
    await getOwnedCollection(collectionId, userId, client);
    const result = await client.query(
      'DELETE FROM place_collection_items WHERE collection_id = $1 AND place_id = $2',
      [collectionId, placeId]
    );
    if (result.rowCount) {
      await client.query('UPDATE place_collections SET updated_at = NOW() WHERE id = $1', [collectionId]);
    }
    return { removed: result.rowCount > 0 };
  });
}
