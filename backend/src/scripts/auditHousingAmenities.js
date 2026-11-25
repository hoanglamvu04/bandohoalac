import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_AREA_ZONES } from '../config/mapCoverage.js';
import { pool } from '../database/pool.js';
import { AMENITY_CATEGORIES, AMENITY_FRESHNESS_DAYS } from '../services/housingInsights.service.js';

const RADIUS_M = 1000;
const OUTSIDE_ZONE_ID = 'outside-service-zones';

export async function auditHousingAmenities(client = pool) {
  const { rows } = await client.query(
    `WITH zones AS (
       SELECT id, name, radius_m, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS center
         FROM jsonb_to_recordset($1::jsonb) AS z(
           id text, name text, radius_m int, lng double precision, lat double precision
         )
     ), active_listings AS MATERIALIZED (
       SELECT p.location::geography AS location,
              COALESCE(zone.id, $4) AS zone_id
         FROM housing_listings hl
         JOIN places p ON p.id = hl.place_id
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN LATERAL (
           SELECT z.id
             FROM zones z
            WHERE ST_DWithin(p.location::geography, z.center, z.radius_m, false)
            ORDER BY ST_Distance(p.location::geography, z.center, false), z.id
            LIMIT 1
         ) zone ON true
        WHERE p.status = 'PUBLISHED' AND c.slug = 'bat-dong-san'
          AND hl.listing_status = 'ACTIVE'
          AND (hl.expires_at IS NULL OR hl.expires_at > NOW())
     ), listing_totals AS (
       SELECT zone_id, COUNT(*)::int AS active_listings
         FROM active_listings GROUP BY zone_id
     ), observed AS (
       SELECT l.zone_id, nearby.slug,
              COUNT(*)::int AS listings_with_poi,
              COUNT(*) FILTER (WHERE nearby.recent)::int AS listings_with_recent_poi
         FROM active_listings l
         JOIN LATERAL (
           SELECT c.slug, BOOL_OR(p.last_verified_at BETWEEN
                    NOW() - INTERVAL '${AMENITY_FRESHNESS_DAYS} days' AND NOW()) AS recent
             FROM places p
             JOIN categories c ON c.id = p.category_id
            WHERE p.status = 'PUBLISHED' AND c.slug = ANY($2::text[])
              AND ST_DWithin(p.location::geography, l.location, $3)
            GROUP BY c.slug
         ) nearby ON true
        GROUP BY l.zone_id, nearby.slug
     ), report_zones AS (
       SELECT id, name FROM zones
       UNION ALL
       SELECT $4, 'Ngoài vùng phục vụ'
     )
     SELECT z.id AS zone_id, z.name AS zone_name, category.slug AS category_slug,
            COALESCE(t.active_listings, 0) AS active_listings,
            COALESCE(o.listings_with_poi, 0) AS listings_with_poi,
            COALESCE(o.listings_with_recent_poi, 0) AS listings_with_recent_poi
       FROM report_zones z
       CROSS JOIN unnest($2::text[]) AS category(slug)
       LEFT JOIN listing_totals t ON t.zone_id = z.id
       LEFT JOIN observed o ON o.zone_id = z.id AND o.slug = category.slug
      ORDER BY z.id, category.slug`,
    [JSON.stringify(SERVICE_AREA_ZONES.map(({ id, name, radiusMeters, center: [lng, lat] }) => ({
      id, name, radius_m: radiusMeters, lng, lat
    }))), AMENITY_CATEGORIES, RADIUS_M, OUTSIDE_ZONE_ID]
  );
  return {
    generatedAt: new Date().toISOString(),
    areaBasis: 'NEAREST_CONFIGURED_SERVICE_ZONE',
    radiusM: RADIUS_M,
    freshnessDays: AMENITY_FRESHNESS_DAYS,
    rows: rows.map((row) => ({
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      categorySlug: row.category_slug,
      activeListings: row.active_listings,
      listingsWithPoi: row.listings_with_poi,
      listingsWithRecentlyVerifiedPoi: row.listings_with_recent_poi
    }))
  };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '30s'");
    const report = await auditHousingAmenities(client);
    await client.query('COMMIT');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.code === '57014'
      ? 'Báo cáo tiện ích vượt thời gian truy vấn.'
      : 'Không thể tạo báo cáo tiện ích. Kiểm tra kết nối và schema cơ sở dữ liệu.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
