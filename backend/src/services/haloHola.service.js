import { pool } from '../database/pool.js';
import { isInsideServiceCoverage } from '../config/mapCoverage.js';
import { AppError } from '../utils/AppError.js';

const MAX_MEDIA_PER_POST = 20;

function text(value, max = 2000) {
  const result = String(value ?? '').trim();
  return result ? result.slice(0, max) : null;
}

function httpUrl(value, { required = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (required) throw new AppError('URL ảnh không được để trống.', 400);
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    return parsed.toString();
  } catch {
    throw new AppError('URL HALO HOLA không hợp lệ.', 400);
  }
}

function normalizeMedia(media) {
  if (!Array.isArray(media) || !media.length) {
    throw new AppError('Bài HALO HOLA phải có ít nhất một ảnh.', 400);
  }
  if (media.length > MAX_MEDIA_PER_POST) {
    throw new AppError(`Mỗi bài HALO HOLA tối đa ${MAX_MEDIA_PER_POST} ảnh.`, 400);
  }

  return media.map((item, index) => ({
    externalMediaId: text(item?.id ?? item?.externalMediaId, 160),
    url: httpUrl(item?.url, { required: true }),
    thumbnailUrl: httpUrl(item?.thumbnailUrl),
    width: Number.isFinite(Number(item?.width)) ? Math.max(1, Math.min(Number(item.width), 20000)) : null,
    height: Number.isFinite(Number(item?.height)) ? Math.max(1, Math.min(Number(item.height), 20000)) : null,
    sortOrder: index,
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  }));
}

async function resolveSpot(client, postId, location = {}) {
  const placeId = location?.placeId ? String(location.placeId).trim() : '';

  if (placeId) {
    const { rows } = await client.query(
      `SELECT id, name, address,
              ST_Y(location) AS lat, ST_X(location) AS lng
       FROM places
       WHERE id = $1 AND status = 'PUBLISHED'
       LIMIT 1`,
      [placeId]
    );
    const place = rows[0];
    if (!place) throw new AppError('Địa điểm Hola Maps không tồn tại hoặc chưa xuất bản.', 404);

    const { rows: spotRows } = await client.query(
      `INSERT INTO halo_spots (place_id, label, address, location, status)
       VALUES ($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),'ACTIVE')
       ON CONFLICT (place_id) WHERE place_id IS NOT NULL DO UPDATE
       SET label = EXCLUDED.label,
           address = EXCLUDED.address,
           location = EXCLUDED.location,
           status = 'ACTIVE',
           updated_at = NOW()
       RETURNING id, place_id, external_spot_id, label, address,
                 ST_Y(location) AS lat, ST_X(location) AS lng`,
      [place.id, place.name, place.address, Number(place.lng), Number(place.lat)]
    );
    return spotRows[0];
  }

  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError('Điểm ghim HALO HOLA thiếu tọa độ hợp lệ.', 400);
  }
  if (!isInsideServiceCoverage(lng, lat)) {
    throw new AppError('Điểm HALO HOLA nằm ngoài vùng phục vụ của Hola Maps.', 400);
  }

  const externalSpotId = text(location?.spotId ?? location?.externalSpotId, 180) || `halo-post:${postId}`;
  const label = text(location?.label, 240) || 'Điểm ảnh HALO HOLA';
  const address = text(location?.address, 500);

  const { rows } = await client.query(
    `INSERT INTO halo_spots (external_spot_id, label, address, location, status)
     VALUES ($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),'ACTIVE')
     ON CONFLICT (external_spot_id) WHERE external_spot_id IS NOT NULL DO UPDATE
     SET label = EXCLUDED.label,
         address = EXCLUDED.address,
         location = EXCLUDED.location,
         status = 'ACTIVE',
         updated_at = NOW()
     RETURNING id, place_id, external_spot_id, label, address,
               ST_Y(location) AS lat, ST_X(location) AS lng`,
    [externalSpotId, label, address, lng, lat]
  );
  return rows[0];
}

export async function upsertHaloPost(payload = {}) {
  const externalPostId = text(payload.postId ?? payload.externalPostId, 180);
  if (!externalPostId) throw new AppError('Thiếu postId của HALO HOLA.', 400);

  const media = normalizeMedia(payload.media ?? payload.images);
  const sourceUrl = httpUrl(payload.sourceUrl ?? payload.url);
  const user = payload.user && typeof payload.user === 'object' ? payload.user : {};
  const location = payload.location && typeof payload.location === 'object' ? payload.location : {};
  const postedAt = payload.postedAt ? new Date(payload.postedAt) : null;
  if (postedAt && Number.isNaN(postedAt.getTime())) {
    throw new AppError('postedAt không hợp lệ.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const spot = await resolveSpot(client, externalPostId, location);

    const { rows } = await client.query(
      `INSERT INTO halo_posts (
         spot_id, external_post_id, external_user_id, external_user_name,
         caption, source_url, status, posted_at, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,'PUBLISHED',$7,$8::jsonb)
       ON CONFLICT (external_post_id) DO UPDATE
       SET spot_id = EXCLUDED.spot_id,
           external_user_id = EXCLUDED.external_user_id,
           external_user_name = EXCLUDED.external_user_name,
           caption = EXCLUDED.caption,
           source_url = EXCLUDED.source_url,
           status = 'PUBLISHED',
           posted_at = EXCLUDED.posted_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
       RETURNING id, external_post_id`,
      [
        spot.id,
        externalPostId,
        text(user.id ?? payload.userId, 180),
        text(user.name ?? payload.userName, 240),
        text(payload.caption, 4000),
        sourceUrl,
        postedAt,
        JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {})
      ]
    );
    const post = rows[0];

    // Replace the media set on every sync. This keeps edits/deletions on HALO HOLA
    // idempotent and prevents stale images from remaining on Hola Maps.
    await client.query('DELETE FROM halo_media WHERE post_id = $1', [post.id]);
    for (const item of media) {
      await client.query(
        `INSERT INTO halo_media (
           post_id, external_media_id, media_type, url, thumbnail_url,
           width, height, sort_order, status, metadata
         ) VALUES ($1,$2,'IMAGE',$3,$4,$5,$6,$7,'ACTIVE',$8::jsonb)`,
        [
          post.id,
          item.externalMediaId,
          item.url,
          item.thumbnailUrl,
          item.width,
          item.height,
          item.sortOrder,
          JSON.stringify(item.metadata)
        ]
      );
    }

    await client.query('COMMIT');
    return {
      ok: true,
      postId: externalPostId,
      internalPostId: String(post.id),
      spot: {
        id: String(spot.id),
        placeId: spot.place_id ? String(spot.place_id) : null,
        externalSpotId: spot.external_spot_id || null,
        label: spot.label,
        address: spot.address || null,
        lat: Number(spot.lat),
        lng: Number(spot.lng)
      },
      mediaCount: media.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteHaloPost(externalPostId) {
  const id = text(externalPostId, 180);
  if (!id) throw new AppError('Thiếu postId của HALO HOLA.', 400);
  const { rowCount } = await pool.query(
    `UPDATE halo_posts
     SET status = 'DELETED', updated_at = NOW()
     WHERE external_post_id = $1`,
    [id]
  );
  return { ok: true, deleted: rowCount > 0 };
}

function boundsWhere(params, values, alias = 'hs') {
  const { west, south, east, north } = params || {};
  const numeric = [west, south, east, north].map(Number);
  if (!numeric.every(Number.isFinite)) return '';
  values.push(...numeric);
  const start = values.length - 3;
  return ` AND ${alias}.location && ST_MakeEnvelope($${start},$${start + 1},$${start + 2},$${start + 3},4326)`;
}

export async function listHaloSpotFeatures(params = {}) {
  const values = [];
  const bbox = boundsWhere(params, values);
  const { rows } = await pool.query(
    `SELECT hs.id, hs.place_id, hs.external_spot_id, hs.label, hs.address,
            ST_Y(hs.location) AS lat, ST_X(hs.location) AS lng,
            COUNT(DISTINCT hp.id)::int AS post_count,
            COUNT(hm.id)::int AS media_count,
            (ARRAY_AGG(COALESCE(hm.thumbnail_url, hm.url)
              ORDER BY COALESCE(hp.posted_at, hp.created_at) DESC, hm.sort_order, hm.id)
              FILTER (WHERE hm.id IS NOT NULL))[1] AS cover_url
     FROM halo_spots hs
     JOIN halo_posts hp ON hp.spot_id = hs.id AND hp.status = 'PUBLISHED'
     JOIN halo_media hm ON hm.post_id = hp.id AND hm.status = 'ACTIVE'
     WHERE hs.status = 'ACTIVE'${bbox}
     GROUP BY hs.id
     ORDER BY MAX(COALESCE(hp.posted_at, hp.created_at)) DESC
     LIMIT 800`,
    values
  );

  return rows.map((row) => ({
    type: 'Feature',
    id: `halo-${row.id}`,
    geometry: {
      type: 'Point',
      coordinates: [Number(row.lng), Number(row.lat)]
    },
    properties: {
      id: `halo-${row.id}`,
      haloSpotId: String(row.id),
      layerType: 'HALO',
      name: row.label,
      address: row.address || null,
      placeId: row.place_id ? String(row.place_id) : null,
      externalSpotId: row.external_spot_id || null,
      postCount: Number(row.post_count) || 0,
      mediaCount: Number(row.media_count) || 0,
      coverUrl: row.cover_url || null,
      sourceLabel: 'HALO HOLA'
    }
  }));
}

function mediaRow(row) {
  return {
    id: String(row.media_id),
    externalMediaId: row.external_media_id || null,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || row.url,
    width: row.width ? Number(row.width) : null,
    height: row.height ? Number(row.height) : null,
    postId: row.external_post_id,
    caption: row.caption || null,
    sourceUrl: row.source_url || null,
    user: row.external_user_id || row.external_user_name ? {
      id: row.external_user_id || null,
      name: row.external_user_name || null
    } : null,
    postedAt: row.posted_at || row.post_created_at
  };
}

async function getSpotBase(whereSql, value) {
  const { rows } = await pool.query(
    `SELECT hs.id, hs.place_id, hs.external_spot_id, hs.label, hs.address,
            ST_Y(hs.location) AS lat, ST_X(hs.location) AS lng
     FROM halo_spots hs
     WHERE hs.status = 'ACTIVE' AND ${whereSql}
     LIMIT 1`,
    [value]
  );
  return rows[0] || null;
}

async function getSpotMedia(spotId, limit = 60) {
  const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 100);
  const { rows } = await pool.query(
    `SELECT hm.id AS media_id, hm.external_media_id, hm.url, hm.thumbnail_url,
            hm.width, hm.height, hp.external_post_id, hp.caption, hp.source_url,
            hp.external_user_id, hp.external_user_name, hp.posted_at,
            hp.created_at AS post_created_at
     FROM halo_posts hp
     JOIN halo_media hm ON hm.post_id = hp.id AND hm.status = 'ACTIVE'
     WHERE hp.spot_id = $1 AND hp.status = 'PUBLISHED'
     ORDER BY COALESCE(hp.posted_at, hp.created_at) DESC, hm.sort_order, hm.id
     LIMIT $2`,
    [spotId, safeLimit]
  );
  return rows.map(mediaRow);
}

function spotPayload(spot, media) {
  return {
    id: String(spot.id),
    placeId: spot.place_id ? String(spot.place_id) : null,
    externalSpotId: spot.external_spot_id || null,
    label: spot.label,
    address: spot.address || null,
    lat: Number(spot.lat),
    lng: Number(spot.lng),
    mediaCount: media.length,
    media
  };
}

export async function getHaloSpot(id, options = {}) {
  const spot = await getSpotBase('hs.id = $1', id);
  if (!spot) throw new AppError('Không tìm thấy điểm HALO HOLA.', 404);
  return spotPayload(spot, await getSpotMedia(spot.id, options.limit));
}

export async function getHaloMediaForPlace(placeId, options = {}) {
  const spot = await getSpotBase('hs.place_id = $1', placeId);
  if (!spot) return null;
  return spotPayload(spot, await getSpotMedia(spot.id, options.limit));
}
