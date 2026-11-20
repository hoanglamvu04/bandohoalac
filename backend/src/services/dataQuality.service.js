import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { isInsideServiceCoverage } from '../config/mapCoverage.js';
import { capturePlaceSnapshot, recordPlaceRevision } from './placeRevision.service.js';

const STALE_DAYS = 180;
const STALE_IMAGE_DAYS = 365;
const DUPLICATE_DISTANCE_METERS = 120;
const TARGET_AREAS = ['Hòa Lạc', 'Hạ Bằng', 'Thạch Thất', 'Tây Phương', 'Yên Xuân', 'Phú Cát', 'Ba Vì', 'Quốc Oai'];

function ageDays(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function scorePlace(row) {
  const issues = [];
  let score = 100;
  const verifiedAge = ageDays(row.last_verified_at);
  const imageAge = ageDays(row.latest_image_at);
  const imageCount = Number(row.image_count || 0);
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const hasCoordinates =
    row.lat !== null && row.lat !== undefined &&
    row.lng !== null && row.lng !== undefined &&
    Number.isFinite(lat) && Number.isFinite(lng);
  const isRealEstate = row.category_slug === 'bat-dong-san';
  const insideCoverage = hasCoordinates ? isInsideServiceCoverage(lng, lat) : false;
  const duplicateCount = Number(row.duplicate_count || 1);

  if (!String(row.address || '').trim()) { issues.push('MISSING_ADDRESS'); score -= 12; }
  if (!String(row.description || '').trim()) { issues.push('MISSING_DESCRIPTION'); score -= 8; }
  if (!row.category_id) { issues.push('MISSING_CATEGORY'); score -= 10; }
  // Homes/plots have no business opening hours, unlike cafés and shops.
  if (!isRealEstate && !row.opening_hours) { issues.push('MISSING_HOURS'); score -= 18; }
  if (isRealEstate ? !String(row.phone || '').trim() : (!row.phone && !row.website)) {
    issues.push('MISSING_CONTACT'); score -= isRealEstate ? 15 : 7;
  }
  if (isRealEstate) {
    if (!row.housing_listing_type || !row.housing_property_type) {
      issues.push('INCOMPLETE_PROPERTY_PROFILE'); score -= 20;
    } else {
      const value = row.housing_listing_type === 'SALE'
        ? Number(row.housing_total_price_vnd)
        : Number(row.housing_monthly_rent);
      if (!Number.isFinite(value) || value <= 0) {
        issues.push('MISSING_PROPERTY_PRICE'); score -= 20;
      }
      if (!Number.isFinite(Number(row.housing_area_m2)) ||
          Number(row.housing_area_m2) <= 0) {
        issues.push('MISSING_PROPERTY_AREA'); score -= 10;
      }
    }
    if (row.housing_listing_status && row.housing_listing_status !== 'ACTIVE') {
      issues.push('PROPERTY_NOT_ACTIVE'); score -= 25;
    }
    if (row.housing_expires_at && new Date(row.housing_expires_at).getTime() <= Date.now()) {
      issues.push('PROPERTY_EXPIRED'); score -= 30;
    }
  }
  if (!imageCount) { issues.push('MISSING_IMAGES'); score -= 25; }
  if (!hasCoordinates) { issues.push('MISSING_COORDINATES'); score -= 35; }
  if (hasCoordinates && !insideCoverage) { issues.push('OUT_OF_COVERAGE'); score -= 40; }
  if (duplicateCount > 1) { issues.push('POSSIBLE_DUPLICATE'); score -= 20; }
  if (imageCount > 0 && imageAge !== null && imageAge > STALE_IMAGE_DAYS) {
    issues.push('STALE_IMAGES'); score -= 10;
  }
  if (verifiedAge === null) {
    issues.push('NEVER_VERIFIED'); score -= 20;
  } else if (verifiedAge > STALE_DAYS) {
    issues.push('STALE_PLACE'); score -= 20;
  }

  return {
    id: String(row.id),
    name: row.name,
    address: row.address,
    category: row.category_name,
    categorySlug: row.category_slug,
    status: row.status,
    propertyListingStatus: isRealEstate ? row.housing_listing_status || null : null,
    propertyExpiresAt: isRealEstate ? row.housing_expires_at || null : null,
    lat: hasCoordinates ? lat : null,
    lng: hasCoordinates ? lng : null,
    insideCoverage: hasCoordinates ? insideCoverage : null,
    duplicateCount,
    imageCount,
    latestImageAt: row.latest_image_at,
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
    verifiedAgeDays: verifiedAge,
    imageAgeDays: imageAge,
    qualityScore: Math.max(0, score),
    issues
  };
}

function buildCoverage(items) {
  const buckets = TARGET_AREAS.map((name) => ({
    name,
    key: normalizeSearch(name),
    items: []
  }));
  const unassigned = [];

  for (const item of items) {
    const haystack = normalizeSearch(`${item.address || ''} ${item.name || ''}`);
    const bucket = buckets.find((entry) => haystack.includes(entry.key));
    if (bucket) bucket.items.push(item);
    else unassigned.push(item);
  }

  const areas = buckets.map((bucket) => {
    const total = bucket.items.length;
    const needsAttention = bucket.items.filter((item) => item.issues.length > 0).length;
    const missingImages = bucket.items.filter((item) => item.issues.includes('MISSING_IMAGES')).length;
    const possibleDuplicates = bucket.items.filter((item) => item.issues.includes('POSSIBLE_DUPLICATE')).length;
    const outOfCoverage = bucket.items.filter((item) => item.issues.includes('OUT_OF_COVERAGE')).length;
    const averageScore = total
      ? Math.round(bucket.items.reduce((sum, item) => sum + item.qualityScore, 0) / total)
      : 0;
    return {
      name: bucket.name,
      total,
      needsAttention,
      missingImages,
      possibleDuplicates,
      outOfCoverage,
      averageScore
    };
  });

  return {
    areas,
    unassigned: unassigned.length,
    bestCovered: [...areas].sort((a, b) => b.total - a.total)[0]?.name || null,
    weakestQuality: [...areas].filter((item) => item.total > 0).sort((a, b) => a.averageScore - b.averageScore)[0]?.name || null
  };
}

export async function getDataQualityOverview({ limit = 100 } = {}) {
  const { rows } = await pool.query(
    `WITH enriched AS (
       SELECT
         p.id, p.name, p.address, p.description, p.category_id,
         p.phone, p.website, p.opening_hours, p.status,
         p.last_verified_at, p.created_at, p.updated_at,
         p.location,
         c.name AS category_name, c.slug AS category_slug,
         hl.listing_type AS housing_listing_type,
         hl.property_type AS housing_property_type,
         hl.listing_status AS housing_listing_status,
         hl.total_price_vnd AS housing_total_price_vnd,
         hl.monthly_rent AS housing_monthly_rent,
         hl.area_m2 AS housing_area_m2,
         hl.expires_at AS housing_expires_at,
         ST_Y(p.location)::double precision AS lat,
         ST_X(p.location)::double precision AS lng,
         LOWER(REGEXP_REPLACE(TRIM(p.name), '\\s+', ' ', 'g')) AS normalized_name,
         (SELECT COUNT(*)::int FROM place_images pi WHERE pi.place_id = p.id) AS image_count,
         (SELECT MAX(pi.created_at) FROM place_images pi WHERE pi.place_id = p.id) AS latest_image_at
       FROM places p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN housing_listings hl ON hl.place_id = p.id
       WHERE p.status = 'PUBLISHED'
     ),
     duplicate_counts AS (
       SELECT
         a.id,
         (1 + COUNT(b.id))::int AS duplicate_count
       FROM enriched a
       LEFT JOIN enriched b
         ON b.id <> a.id
        AND a.location IS NOT NULL
        AND b.location IS NOT NULL
        AND a.normalized_name <> ''
        AND b.normalized_name = a.normalized_name
        AND ST_DWithin(a.location::geography, b.location::geography, $1)
       GROUP BY a.id
     )
     SELECT enriched.*,
            COALESCE(duplicate_counts.duplicate_count, 1)::int AS duplicate_count,
            (SELECT COUNT(*)::int FROM places WHERE status = 'PUBLISHED') AS published_total
     FROM enriched
     LEFT JOIN duplicate_counts ON duplicate_counts.id = enriched.id
     ORDER BY enriched.updated_at ASC
     LIMIT 5000`,
    [DUPLICATE_DISTANCE_METERS]
  );

  const all = rows.map(scorePlace);
  const actualPublished = Number(rows[0]?.published_total || 0);
  const needsAttention = all.filter((item) => item.issues.length > 0);
  const summary = {
    totalPublished: actualPublished,
    auditedCount: all.length,
    auditPartial: actualPublished > all.length,
    needsAttention: needsAttention.length,
    missingImages: all.filter((item) => item.issues.includes('MISSING_IMAGES')).length,
    missingHours: all.filter((item) => item.issues.includes('MISSING_HOURS')).length,
    missingCoordinates: all.filter((item) => item.issues.includes('MISSING_COORDINATES')).length,
    outOfCoverage: all.filter((item) => item.issues.includes('OUT_OF_COVERAGE')).length,
    possibleDuplicates: all.filter((item) => item.issues.includes('POSSIBLE_DUPLICATE')).length,
    stalePlaces: all.filter((item) => item.issues.includes('STALE_PLACE') || item.issues.includes('NEVER_VERIFIED')).length,
    unverifiedPlaces: all.filter((item) => item.issues.includes('NEVER_VERIFIED')).length,
    staleImages: all.filter((item) => item.issues.includes('STALE_IMAGES')).length,
    incompleteProperties: all.filter((item) => item.issues.includes('INCOMPLETE_PROPERTY_PROFILE')).length,
    missingPropertyPrices: all.filter((item) => item.issues.includes('MISSING_PROPERTY_PRICE')).length,
    expiredProperties: all.filter((item) => item.issues.includes('PROPERTY_EXPIRED') ||
      item.issues.includes('PROPERTY_NOT_ACTIVE')).length,
    averageScore: all.length
      ? Math.round(all.reduce((sum, item) => sum + item.qualityScore, 0) / all.length)
      : 100
  };

  const items = needsAttention
    .sort((a, b) => a.qualityScore - b.qualityScore || Number(b.verifiedAgeDays || 0) - Number(a.verifiedAgeDays || 0))
    .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 300));

  return {
    version: 3,
    summary,
    coverage: buildCoverage(all),
    items,
    thresholds: {
      staleDays: STALE_DAYS,
      staleImageDays: STALE_IMAGE_DAYS,
      duplicateDistanceMeters: DUPLICATE_DISTANCE_METERS
    }
  };
}

export async function markPlaceVerified({ placeId, actorUserId, actorRole }) {
  const source = ['ADMIN', 'MODERATOR'].includes(String(actorRole || '').toUpperCase())
    ? 'HOLA'
    : 'COMMUNITY';

  return withTransaction(async (client) => {
    const before = await capturePlaceSnapshot(placeId, client);
    if (!before) throw new AppError('Place not found.', 404);

    if (source === 'HOLA') {
      await client.query(
        `UPDATE places
         SET last_verified_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [placeId]
      );
    }

    await client.query(
      `INSERT INTO place_verification_events (
         place_id, actor_user_id, source, event_type, note
       ) VALUES ($1, $2, $3, 'VERIFIED', $4)`,
      [
        placeId,
        actorUserId || null,
        source,
        source === 'HOLA'
          ? 'HOLA kiểm tra và xác minh dữ liệu địa điểm'
          : 'Cộng tác viên xác minh dữ liệu địa điểm'
      ]
    );

    const after = await capturePlaceSnapshot(placeId, client);
    await recordPlaceRevision({
      placeId,
      action: 'VERIFY',
      beforeSnapshot: before,
      afterSnapshot: after,
      actorUserId,
      reason: source === 'HOLA'
        ? 'HOLA xác minh dữ liệu địa điểm'
        : 'Cộng đồng xác minh dữ liệu địa điểm'
    }, client);

    return {
      ...after,
      verificationSource: source,
      verificationRecordedAt: new Date().toISOString()
    };
  });
}
