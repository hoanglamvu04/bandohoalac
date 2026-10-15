import { pool } from '../database/pool.js';

function ageMinutes(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / 60000));
}

export async function getHaloSyncMonitor({ limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const [{ rows: summaryRows }, { rows: recentRows }] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED')::int AS published_posts,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'DELETED')::int AS deleted_posts,
         COUNT(DISTINCT hp.spot_id) FILTER (WHERE hp.status = 'PUBLISHED' AND hp.spot_id IS NOT NULL)::int AS active_spots,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hs.place_id IS NOT NULL)::int AS canonical_posts,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hs.id IS NOT NULL AND hs.place_id IS NULL)::int AS pin_posts,
         COUNT(DISTINCT hm.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hm.status = 'ACTIVE')::int AS active_media,
         COUNT(DISTINCT hp.id) FILTER (WHERE hp.status = 'PUBLISHED' AND hs.id IS NULL)::int AS published_without_spot,
         COUNT(DISTINCT hp.id) FILTER (
           WHERE hp.status = 'PUBLISHED'
             AND NOT EXISTS (
               SELECT 1
               FROM halo_media active_hm
               WHERE active_hm.post_id = hp.id AND active_hm.status = 'ACTIVE'
             )
         )::int AS published_without_media,
         COUNT(DISTINCT hp.id) FILTER (
           WHERE hp.status = 'PUBLISHED'
             AND (hp.source_url IS NULL OR BTRIM(hp.source_url) = '')
         )::int AS missing_source_urls,
         COUNT(DISTINCT hm.id) FILTER (
           WHERE hp.status = 'PUBLISHED'
             AND hm.status = 'ACTIVE'
             AND (
               hm.url IS NULL OR
               hm.url NOT LIKE 'https://halohola.vn/api/submissions/media/%/halo'
             )
         )::int AS unstable_media_urls,
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
  const summary = {
    publishedPosts: Number(row.published_posts || 0),
    deletedPosts: Number(row.deleted_posts || 0),
    activeSpots: Number(row.active_spots || 0),
    canonicalPosts: Number(row.canonical_posts || 0),
    pinPosts: Number(row.pin_posts || 0),
    activeMedia: Number(row.active_media || 0),
    hiddenTempSpots: Number(row.hidden_temp_spots || 0),
    publishedWithoutSpot: Number(row.published_without_spot || 0),
    publishedWithoutMedia: Number(row.published_without_media || 0),
    missingSourceUrls: Number(row.missing_source_urls || 0),
    unstableMediaUrls: Number(row.unstable_media_urls || 0),
    lastSyncAt: row.last_sync_at || null,
    lastPublishedAt: row.last_published_at || null,
    lastSyncAgeMinutes: ageMinutes(row.last_sync_at)
  };

  const integrityIssueCount =
    summary.publishedWithoutSpot +
    summary.publishedWithoutMedia +
    summary.missingSourceUrls +
    summary.unstableMediaUrls;

  return {
    ok: true,
    version: 3,
    health: {
      status: summary.publishedPosts === 0
        ? 'IDLE'
        : integrityIssueCount > 0
          ? 'ATTENTION'
          : 'HEALTHY',
      integrityIssueCount
    },
    summary,
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
