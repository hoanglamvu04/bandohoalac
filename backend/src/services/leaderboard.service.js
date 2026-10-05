import { pool } from '../database/pool.js';
import { reputationFromRow } from './reputation.service.js';

function mapRows(rows) {
  return rows.map((row, index) => {
    const reputation = reputationFromRow(row);
    return {
      rank: index + 1,
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      points: Number(row.points) || 0,
      allTimePoints: Number(row.points_total) || 0,
      trustScore: Number(row.trust_score) || 0,
      approvedCount: Number(row.approved_count) || 0,
      placesCount: Number(row.places_count) || 0,
      photosCount: Number(row.photos_count) || 0,
      reputationScore: reputation.score,
      reputationLevel: {
        code: reputation.code,
        name: reputation.name
      }
    };
  });
}

export async function getLeaderboard(limit = 20, period = 'month') {
  const safeLimit = Math.min(Number(limit) || 20, 100);

  if (period === 'all') {
    const candidateLimit = Math.min(Math.max(safeLimit * 10, 200), 1000);
    const { rows } = await pool.query(
      `WITH quality_points AS (
         SELECT user_id, COALESCE(SUM(amount), 0)::int AS points
         FROM points_transactions
         WHERE contribution_id IS NOT NULL AND amount > 0
         GROUP BY user_id
       )
       SELECT
         u.id, u.name, u.avatar_url, u.points_total, u.trust_score,
         u.approved_count, u.rejected_count, u.created_at,
         u.points_total AS points,
         COALESCE(qp.points, 0) AS quality_points,
         (SELECT COUNT(*)::int
          FROM places
          WHERE created_by = u.id AND status = 'PUBLISHED') AS places_count,
         (SELECT COUNT(*)::int
          FROM place_images
          WHERE uploaded_by = u.id) AS photos_count
       FROM users u
       LEFT JOIN quality_points qp ON qp.user_id = u.id
       WHERE u.role IN ('USER', 'CONTRIBUTOR', 'CTV', 'MODERATOR', 'ADMIN')
       ORDER BY u.approved_count DESC, u.trust_score DESC, u.points_total DESC, u.id ASC
       LIMIT $1`,
      [candidateLimit]
    );

    const ranked = rows
      .map((row) => ({ row, reputation: reputationFromRow(row) }))
      .sort((a, b) =>
        b.reputation.score - a.reputation.score ||
        Number(b.row.approved_count || 0) - Number(a.row.approved_count || 0) ||
        Number(b.row.quality_points || 0) - Number(a.row.quality_points || 0) ||
        Number(b.row.points_total || 0) - Number(a.row.points_total || 0) ||
        Number(a.row.id) - Number(b.row.id)
      )
      .slice(0, safeLimit)
      .map((item) => item.row);

    return mapRows(ranked);
  }

  const { rows } = await pool.query(
    `WITH month_points AS (
       SELECT user_id, COALESCE(SUM(amount), 0)::int AS points
       FROM points_transactions
       WHERE contribution_id IS NOT NULL
         AND amount > 0
         AND created_at >= date_trunc('month', NOW())
         AND created_at < date_trunc('month', NOW()) + interval '1 month'
       GROUP BY user_id
     ),
     quality_points AS (
       SELECT user_id, COALESCE(SUM(amount), 0)::int AS points
       FROM points_transactions
       WHERE contribution_id IS NOT NULL AND amount > 0
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
       u.id, u.name, u.avatar_url, u.points_total, u.trust_score,
       u.approved_count, u.rejected_count, u.created_at,
       COALESCE(mp.points, 0) AS points,
       COALESCE(qp.points, 0) AS quality_points,
       COALESCE(mpl.count, 0) AS places_count,
       COALESCE(mph.count, 0) AS photos_count
     FROM users u
     LEFT JOIN month_points mp ON mp.user_id = u.id
     LEFT JOIN quality_points qp ON qp.user_id = u.id
     LEFT JOIN month_places mpl ON mpl.user_id = u.id
     LEFT JOIN month_photos mph ON mph.user_id = u.id
     WHERE u.role IN ('USER', 'CONTRIBUTOR', 'CTV', 'MODERATOR', 'ADMIN')
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
