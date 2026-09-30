import { query } from '../database/pool.js';

const HANOI_TODAY_SQL = "(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";

function mapAd(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    imageUrl: row.image_url,
    targetUrl: row.target_url,
    altText: row.alt_text,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageStorageProvider: row.image_storage_provider,
    imageStoragePublicId: row.image_storage_public_id,
    imageStorageFilename: row.image_storage_filename
  };
}

export async function isAdsHiddenToday(userId) {
  if (!userId) return false;
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM ad_daily_hides
       WHERE user_id = $1
         AND hide_date = ${HANOI_TODAY_SQL}
     ) AS hidden`,
    [userId]
  );
  return Boolean(result.rows[0]?.hidden);
}

export async function listPublicAds(userId = null) {
  if (userId && await isAdsHiddenToday(userId)) {
    return { items: [], hiddenToday: true };
  }

  const result = await query(
    `SELECT *
     FROM advertisements
     WHERE status = 'ACTIVE'
       AND image_url IS NOT NULL
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY sort_order ASC, id DESC`
  );

  return {
    items: result.rows.map(mapAd),
    hiddenToday: false
  };
}

export async function hideAdsForToday(userId) {
  await query(
    `INSERT INTO ad_daily_hides (user_id, hide_date)
     VALUES ($1, ${HANOI_TODAY_SQL})
     ON CONFLICT (user_id, hide_date) DO NOTHING`,
    [userId]
  );
  return { hiddenToday: true };
}

export async function listAdminAds() {
  const result = await query(
    `SELECT *
     FROM advertisements
     ORDER BY
       CASE status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
       sort_order ASC,
       id DESC`
  );
  return result.rows.map(mapAd);
}

export async function getAdById(id) {
  const result = await query('SELECT * FROM advertisements WHERE id = $1', [id]);
  return mapAd(result.rows[0]);
}

export async function createAd({
  title,
  targetUrl,
  altText = null,
  status = 'DRAFT',
  sortOrder = 0,
  startsAt = null,
  endsAt = null,
  createdBy
}) {
  const result = await query(
    `INSERT INTO advertisements (
       title, target_url, alt_text, status, sort_order,
       starts_at, ends_at, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [title, targetUrl, altText, status, sortOrder, startsAt, endsAt, createdBy]
  );
  return mapAd(result.rows[0]);
}

export async function updateAd(id, values = {}) {
  const columnMap = {
    title: 'title',
    targetUrl: 'target_url',
    altText: 'alt_text',
    status: 'status',
    sortOrder: 'sort_order',
    startsAt: 'starts_at',
    endsAt: 'ends_at'
  };

  const entries = Object.entries(values)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(columnMap, key));

  if (!entries.length) return getAdById(id);

  const params = [];
  const assignments = entries.map(([key, value], index) => {
    params.push(value);
    return `${columnMap[key]} = $${index + 1}`;
  });

  params.push(id);
  const result = await query(
    `UPDATE advertisements
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  return mapAd(result.rows[0]);
}

export async function setAdImage(id, asset) {
  const result = await query(
    `UPDATE advertisements
     SET image_url = $1,
         image_storage_provider = $2,
         image_storage_public_id = $3,
         image_storage_filename = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      asset?.url || null,
      asset?.provider || null,
      asset?.publicId || null,
      asset?.filename || null,
      id
    ]
  );
  return mapAd(result.rows[0]);
}

export async function archiveAd(id) {
  const result = await query(
    `UPDATE advertisements
     SET status = 'ARCHIVED', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return mapAd(result.rows[0]);
}
