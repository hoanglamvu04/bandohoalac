import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

// Price observations are user-provided asking prices, NOT completed transactions
// or appraised values. Small samples cannot produce meaningful quartiles.
export const MIN_VISIBLE_MARKET_SAMPLE = 5;
export const MAX_AMENITY_CANDIDATES = 100;
export const AMENITY_FRESHNESS_DAYS = 180;
export const AMENITY_CATEGORIES = Object.freeze([
  'truong-hoc', 'y-te', 'sieu-thi', 'ngan-hang-atm',
  'nhien-lieu-sac', 'giao-thong', 'an-uong', 'cafe'
]);

function safeMoney(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * Aggregation is performed inside PostgreSQL, never by retrieving contacts,
 * coordinates or descriptions. Do not add a listing ID to this response.
 */
export async function getHousingAskingPriceInsights(filters, db = pool) {
  const { listingType = 'SALE', propertyType = null, west, south, east, north } = filters;
  const bounded = [west, south, east, north].every((value) => value !== undefined);
  const params = [listingType, propertyType];
  let spatial = '';
  if (bounded) {
    params.push(west, south, east, north);
    spatial = 'AND ST_Intersects(p.location, ST_MakeEnvelope($3,$4,$5,$6,4326))';
  }
  const { rows } = await db.query(
    `WITH listed AS (
       SELECT (
         CASE WHEN hl.listing_type = 'SALE'
           THEN hl.total_price_vnd ELSE hl.monthly_rent
         END
       )::numeric / NULLIF(hl.area_m2, 0) AS unit_price
         FROM places p
         JOIN categories c ON c.id = p.category_id
         JOIN housing_listings hl ON hl.place_id = p.id
        WHERE p.status = 'PUBLISHED'
          AND c.slug = 'bat-dong-san'
          AND p.external_source IS DISTINCT FROM 'HOLA_THACH_THAT_DEMO_2026'
          AND hl.listing_status = 'ACTIVE'
          AND (hl.expires_at IS NULL OR hl.expires_at > NOW())
          AND hl.listing_type = $1
          AND ($2::text IS NULL OR hl.property_type = $2)
          AND hl.area_m2 BETWEEN 1 AND 99999.99
          ${spatial}
     )
     SELECT COUNT(*)::int AS sample_count,
            ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY unit_price))::bigint AS p25,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY unit_price))::bigint AS p50,
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY unit_price))::bigint AS p75
       FROM listed
      WHERE unit_price > 0 AND unit_price <= 1000000000000`,
    params
  );
  const row = rows[0] || {};
  const sampleCount = Number(row.sample_count) || 0;
  const sufficientSample = sampleCount >= MIN_VISIBLE_MARKET_SAMPLE;
  return {
    source: 'PUBLISHED_ACTIVE_ASKING_PRICES',
    listingType,
    propertyType,
    areaBasis: bounded ? 'MAP_VIEWPORT' : 'ALL_HOLA_MAPS',
    sampleCount,
    minSample: MIN_VISIBLE_MARKET_SAMPLE,
    sufficientSample,
    unit: listingType === 'SALE' ? 'VND_PER_M2' : 'VND_PER_M2_PER_MONTH',
    quartiles: sufficientSample
      ? { p25: safeMoney(row.p25), median: safeMoney(row.p50), p75: safeMoney(row.p75) }
      : null,
    disclaimer: 'Giá người đăng chào, không phải giá giao dịch hay định giá. Phân vị không xác nhận giá trị pháp lý.'
  };
}

// Exploratory warning only. Must never cause automatic rejection, moderation,
// visibility changes, or fraud/ownership assertions.
export function classifyQuotedUnitPrice(pricePerM2, insights) {
  const value = Number(pricePerM2);
  const q = insights?.quartiles;
  if (!insights?.sufficientSample || !q ||
      !Number.isFinite(value) || value <= 0 ||
      !Number.isFinite(Number(q.p25)) || !Number.isFinite(Number(q.p75))) {
    return 'INSUFFICIENT';
  }
  if (value < Number(q.p25) * 0.6) return 'BELOW_REFERENCE';
  if (value > Number(q.p75) * 1.6) return 'ABOVE_REFERENCE';
  return 'WITHIN_REFERENCE';
}

function checkPublicPlaceId(placeId) {
  const id = String(placeId || '');
  if (!/^[1-9]\d{0,14}$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw new AppError('Mã bất động sản không hợp lệ.', 400);
  }
  return id;
}

/**
 * Nearby context is anchored only on an already-public housing listing ID;
 * the caller does not submit or expose a user's GPS. This result contains
 * public place names + counts, not contacts, user IDs or coordinates.
 */
export async function getHousingNearbyAmenities(placeId, radius = '1000', db = pool) {
  const id = checkPublicPlaceId(placeId);
  const radiusM = Number(radius);
  if (![500,1000,2000].includes(radiusM)) {
    throw new AppError('Bán kính tiện ích không hợp lệ.', 400);
  }
  const listing = await db.query(
    `SELECT p.id
       FROM places p
       JOIN categories c ON c.id = p.category_id
       JOIN housing_listings hl ON hl.place_id = p.id
      WHERE p.id = $1 AND p.status = 'PUBLISHED'
        AND c.slug = 'bat-dong-san'
        AND hl.listing_status = 'ACTIVE'
        AND (hl.expires_at IS NULL OR hl.expires_at > NOW())`,
    [id]
  );
  if (!listing.rows.length) {
    throw new AppError('Tin đã ẩn, hết hạn hoặc không tồn tại.', 404);
  }
  const { rows } = await db.query(
    `SELECT p.id, p.name, c.name AS category_name, c.slug AS category_slug,
            CASE
              WHEN p.last_verified_at IS NULL OR p.last_verified_at > NOW() THEN 'UNKNOWN'
              WHEN p.last_verified_at >= NOW() - INTERVAL '${AMENITY_FRESHNESS_DAYS} days' THEN 'RECENT'
              ELSE 'OLDER'
            END AS verification_age,
            ROUND(ST_Distance(p.location::geography, anchor.location::geography))::int AS distance_m
       FROM places p
       JOIN categories c ON c.id = p.category_id
       JOIN places anchor ON anchor.id = $1
       JOIN housing_listings hl ON hl.place_id = anchor.id
      WHERE p.status = 'PUBLISHED' AND anchor.status = 'PUBLISHED'
        AND hl.listing_status = 'ACTIVE'
        AND (hl.expires_at IS NULL OR hl.expires_at > NOW())
        AND c.slug = ANY($3::text[])
        AND p.id <> anchor.id
        AND ST_DWithin(p.location::geography, anchor.location::geography, $2)
      ORDER BY distance_m ASC, p.id ASC
      LIMIT ${MAX_AMENITY_CANDIDATES + 1}`,
    [id, radiusM, AMENITY_CATEGORIES]
  );
  const limited = rows.slice(0, MAX_AMENITY_CANDIDATES);
  const counts = new Map();
  const verification = { recent: 0, older: 0, unknown: 0 };
  for (const row of limited) {
    if (row.verification_age === 'RECENT') verification.recent++;
    else if (row.verification_age === 'OLDER') verification.older++;
    else verification.unknown++;
    const categorySlug = String(row.category_slug);
    const entry = counts.get(categorySlug) || {
      categorySlug, name: String(row.category_name), count: 0
    };
    entry.count++;
    counts.set(categorySlug, entry);
  }
  return {
    placeId: id,
    radiusM,
    matchedCount: limited.length,
    capped: rows.length > MAX_AMENITY_CANDIDATES,
    dataQuality: {
      trackedCategoryCount: AMENITY_CATEGORIES.length,
      freshnessDays: AMENITY_FRESHNESS_DAYS,
      verification
    },
    categories: [...counts.values()].sort((a,b) => b.count-a.count || a.categorySlug.localeCompare(b.categorySlug)),
    places: limited.slice(0, 8).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      categorySlug: String(row.category_slug),
      distanceM: Number(row.distance_m)
    })),
    method: 'STRAIGHT_LINE_DISTANCE',
    disclaimer: 'Khoảng cách đường thẳng, không phải khoảng cách hoặc thời gian đi đường. Dữ liệu địa điểm có thể chưa đầy đủ.'
  };
}
