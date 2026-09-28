import { pool } from '../database/pool.js';

function mapRows(rows) {
  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    points: Number(row.points) || 0,
    allTimePoints: Number(row.points_total) || 0,
    trustScore: row.trust_score,
    approvedCount: row.approved_count,
    placesCount: Number(row.places_count) || 0,
    photosCount: Number(row.photos_count) || 0
  }));
}

export async function getLeaderboard(limit = 20, period = 'month') {
  const safeLimit = Math.min(Number(limit) || 20, 100);

  if (period === 'all') {
    const { rows } = await pool.query(
      `SELECT
         u.id, u.name, u.avatar_url, u.points_total, u.trust_score, u.approved_count,
         u.points_total AS points,
         (SELECT COUNT(*)::int
          FROM places
          WHERE created_by = u.id AND status = 'PUBLISHED') AS places_count,
         (SELECT COUNT(*)::int
          FROM place_images
          WHERE uploaded_by = u.id) AS photos_count
       FROM users u
       WHERE u.role IN ('USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN')
       ORDER BY u.points_total DESC, u.trust_score DESC, u.id ASC
       LIMIT $1`,
      [safeLimit]
    );
    return mapRows(rows);
  }

  const { rows } = await pool.query(
    `WITH month_points AS (
       SELECT user_id, COALESCE(SUM(amount), 0)::int AS points
       FROM points_transactions
       WHERE created_at >= date_trunc('month', NOW())
         AND created_at < date_trunc('month', NOW()) + interval '1 month'
       GROUP BY user_id
     ),
     month_places AS (
       SELECT created_by AS user_id, COUNT(*)::int AS count
       FROM places
       WHERE status = 'PUBLISHED'
         AND created_at >= date_trunc('month', NOW())
         AND created_at < date_trunc('month', NOW()) + interval '1 month'
       GROUP BY created_by
     ),
     month_photos AS (
       SELECT uploaded_by AS user_id, COUNT(*)::int AS count
       FROM place_images
       WHERE created_at >= date_trunc('month', NOW())
         AND created_at < date_trunc('month', NOW()) + interval '1 month'
       GROUP BY uploaded_by
     )
     SELECT
       u.id, u.name, u.avatar_url, u.points_total, u.trust_score, u.approved_count,
       COALESCE(mp.points, 0) AS points,
       COALESCE(mpl.count, 0) AS places_count,
       COALESCE(mph.count, 0) AS photos_count
     FROM users u
     LEFT JOIN month_points mp ON mp.user_id = u.id
     LEFT JOIN month_places mpl ON mpl.user_id = u.id
     LEFT JOIN month_photos mph ON mph.user_id = u.id
     WHERE u.role IN ('USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN')
       AND (
         COALESCE(mp.points, 0) > 0 OR
         COALESCE(mpl.count, 0) > 0 OR
         COALESCE(mph.count, 0) > 0
       )
     ORDER BY COALESCE(mp.points, 0) DESC, u.trust_score DESC, u.id ASC
     LIMIT $1`,
    [safeLimit]
  );

  return mapRows(rows);
}
