import { pool } from '../database/pool.js';

export async function getHaloSyncMonitor({ limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const [{ rows: summaryRows }, { rows: recentRows }] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED')::int AS published_posts,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'DELETED')::int AS deleted_posts,
         COUNT(DISTINCT hp.spot_id) FILTER (WHERE hp.status = 'PUBLISHED')::int AS active_spots,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hs.place_id IS NOT NULL)::int AS canonical_posts,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hs.place_id IS NULL)::int AS pin_posts,
         COUNT(DISTINCT hm.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hm.status = 'ACTIVE')::int AS active_media,
         MAX(hp.updated_at) AS last_sync_at,
         MAX(COALESCE(hp.posted_at, hp.created_at)) FILTER (WHERE hp.status = 'PUBLISHED') AS last_published_at,
         COUNT(DISTINCT hs.id) FILTER (WHERE hs.status = 'HIDDEN' AND hs.place_id IS NULL)::int AS hidden_temp_spots
       FROM halo_posts hp
       LEFT JOIN halo_spots hs ON hs.id = hp.spot_id
       LEFT JOIN halo_media hm ON hm.post_id = hp.id
       WHERE hp.source = 'HALO_HOLA'`
    ),
    pool.query(
      `SELECT
         hp.id,
         hp.external_post_id,
         hp.status,
         hp.source_url,
         hp.metadata,
         hp.external_user_name,
         hp.posted_at,
         hp.updated_at,
         hs.id AS spot_id,
         hs.place_id,
         hs.external_spot_id,
         hs.label AS spot_label,
         hs.address AS spot_address,
         COUNT(hm.id) FILTER (WHERE hm.status = 'ACTIVE')::int AS media_count
       FROM halo_posts hp
       LEFT JOIN halo_spots hs ON hs.id = hp.spot_id
       LEFT JOIN halo_media hm ON hm.post_id = hp.id
       WHERE hp.source = 'HALO_HOLA'
       GROUP BY hp.id, hs.id
       ORDER BY hp.updated_at DESC
       LIMIT $1`,
      [safeLimit]
    )
  ]);

  const row = summaryRows[0] || {};
  return {
    ok: true,
    summary: {
      publishedPosts: Number(row.published_posts || 0),
      deletedPosts: Number(row.deleted_posts || 0),
      activeSpots: Number(row.active_spots || 0),
      canonicalPosts: Number(row.canonical_posts || 0),
      pinPosts: Number(row.pin_posts || 0),
      activeMedia: Number(row.active_media || 0),
      hiddenTempSpots: Number(row.hidden_temp_spots || 0),
      lastSyncAt: row.last_sync_at || null,
      lastPublishedAt: row.last_published_at || null
    },
    recent: recentRows.map((item) => ({
      id: String(item.id),
      postId: item.external_post_id,
      status: item.status,
      sourceUrl: item.source_url || null,
      code: item.metadata?.code || null,
      title: item.metadata?.title || null,
      theme: item.metadata?.theme || null,
      author: item.external_user_name || null,
      postedAt: item.posted_at || null,
      syncedAt: item.updated_at || null,
      spot: item.spot_id ? {
        id: String(item.spot_id),
        placeId: item.place_id ? String(item.place_id) : null,
        externalSpotId: item.external_spot_id || null,
        label: item.spot_label || null,
        address: item.spot_address || null
      } : null,
      mediaCount: Number(item.media_count || 0)
    }))
  };
}
