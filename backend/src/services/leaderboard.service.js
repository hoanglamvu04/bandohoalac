import { pool } from '../database/pool.js';

export async function getLeaderboard(limit = 20) {
  const { rows } = await pool.query(
    `SELECT
       u.id, u.name, u.avatar_url, u.points_total, u.trust_score, u.approved_count,
       (SELECT COUNT(*)::int FROM places WHERE created_by = u.id AND status = 'PUBLISHED') AS places_count,
       (SELECT COUNT(*)::int FROM place_images WHERE uploaded_by = u.id) AS photos_count
     FROM users u
     WHERE u.role IN ('USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN')
     ORDER BY u.points_total DESC, u.trust_score DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    points: row.points_total,
    trustScore: row.trust_score,
    approvedCount: row.approved_count,
    placesCount: row.places_count,
    photosCount: row.photos_count
  }));
}
