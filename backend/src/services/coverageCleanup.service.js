import { pool } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING, CORE_SERVICE_AREAS } from '../config/mapCoverage.js';
import { invalidatePlaceBoundsCache } from './place.service.js';

export async function getOutsideCoverageSummary({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const sql = [
    'WITH service_area AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom',
    '), outside_places AS (',
    '  SELECT p.id, p.name, p.address, p.status, p.source, p.updated_at,',
    '         ST_X(p.location) AS lng, ST_Y(p.location) AS lat,',
    '         c.name AS category, c.slug AS category_slug',
    '  FROM places p',
    '  LEFT JOIN categories c ON c.id = p.category_id',
    '  CROSS JOIN service_area',
    "  WHERE p.status <> 'ARCHIVED'",
    '    AND NOT ST_CoveredBy(p.location, service_area.geom)',
    ')',
    'SELECT *, (SELECT COUNT(*)::int FROM outside_places) AS total_count',
    'FROM outside_places',
    'ORDER BY updated_at DESC, id DESC',
    'LIMIT $2'
  ].join('\n');

  const { rows } = await pool.query(sql, [SERVICE_AREA_GEOJSON_STRING, safeLimit]);
  const total = rows[0]?.total_count || 0;
  return {
    total: Number(total) || 0,
    allowedAreas: CORE_SERVICE_AREAS,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      status: row.status,
      source: row.source,
      category: row.category || 'Địa điểm',
      categorySlug: row.category_slug || 'other',
      lat: Number(row.lat),
      lng: Number(row.lng),
      updatedAt: row.updated_at
    }))
  };
}

export async function archiveOutsideCoveragePlaces() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query([
      'WITH service_area AS (',
      '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom',
      ')',
      'UPDATE places p',
      "SET status = 'ARCHIVED', updated_at = NOW()",
      'FROM service_area',
      "WHERE p.status <> 'ARCHIVED'",
      '  AND NOT ST_CoveredBy(p.location, service_area.geom)',
      'RETURNING p.id, p.name'
    ].join('\n'), [SERVICE_AREA_GEOJSON_STRING]);
    await client.query('COMMIT');
    invalidatePlaceBoundsCache();
    return {
      archived: rows.length,
      ids: rows.map((row) => row.id),
      names: rows.slice(0, 20).map((row) => row.name)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
