import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { capturePlaceSnapshot, recordPlaceRevision } from './placeRevision.service.js';

const STALE_DAYS = 180;
const STALE_IMAGE_DAYS = 365;
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

function scorePlace(row) {
  const issues = [];
  let score = 100;
  const verifiedAge = ageDays(row.last_verified_at || row.updated_at || row.created_at);
  const imageAge = ageDays(row.latest_image_at);
  const imageCount = Number(row.image_count || 0);
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const duplicateCount = Number(row.duplicate_count || 1);

  if (!row.address) { issues.push('MISSING_ADDRESS'); score -= 12; }
  if (!row.description) { issues.push('MISSING_DESCRIPTION'); score -= 8; }
  if (!row.category_id) { issues.push('MISSING_CATEGORY'); score -= 10; }
  if (!row.opening_hours) { issues.push('MISSING_HOURS'); score -= 18; }
  if (!row.phone && !row.website) { issues.push('MISSING_CONTACT'); score -= 7; }
  if (!imageCount) { issues.push('MISSING_IMAGES'); score -= 25; }
  if (!hasCoordinates) { issues.push('MISSING_COORDINATES'); score -= 35; }
  if (duplicateCount > 1) { issues.push('POSSIBLE_DUPLICATE'); score -= 20; }
  if (imageCount > 0 && imageAge !== null && imageAge > STALE_IMAGE_DAYS) {
    issues.push('STALE_IMAGES'); score -= 10;
  }
  if (verifiedAge !== null && verifiedAge > STALE_DAYS) {
    issues.push('STALE_PLACE'); score -= 20;
  }

  return {
    id: String(row.id),
    name: row.name,
    address: row.address,
    category: row.category_name,
    categorySlug: row.category_slug,
    status: row.status,
    lat: hasCoordinates ? lat : null,
    lng: hasCoordinates ? lng : null,
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
    const averageScore = total
      ? Math.round(bucket.items.reduce((sum, item) => sum + item.qualityScore, 0) / total)
      : 0;
    return {
      name: bucket.name,
      total,
      needsAttention,
      missingImages,
      possibleDuplicates,
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
         c.name AS category_name, c.slug AS category_slug,
         ST_Y(p.location)::double precision AS lat,
         ST_X(p.location)::double precision AS lng,
         LOWER(REGEXP_REPLACE(TRIM(p.name), '\\s+', ' ', 'g')) AS normalized_name,
         (SELECT COUNT(*)::int FROM place_images pi WHERE pi.place_id = p.id) AS image_count,
         (SELECT MAX(pi.created_at) FROM place_images pi WHERE pi.place_id = p.id) AS latest_image_at
       FROM places p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'PUBLISHED'
     )
     SELECT enriched.*,
            CASE
              WHEN lat IS NULL OR lng IS NULL THEN 1
              ELSE COUNT(*) OVER (
                PARTITION BY normalized_name, ROUND(lat::numeric, 3), ROUND(lng::numeric, 3)
              )
            END::int AS duplicate_count
     FROM enriched
     ORDER BY updated_at ASC
     LIMIT 5000`
  );

  const all = rows.map(scorePlace);
  const needsAttention = all.filter((item) => item.issues.length > 0);
  const summary = {
    totalPublished: all.length,
    needsAttention: needsAttention.length,
    missingImages: all.filter((item) => item.issues.includes('MISSING_IMAGES')).length,
    missingHours: all.filter((item) => item.issues.includes('MISSING_HOURS')).length,
    missingCoordinates: all.filter((item) => item.issues.includes('MISSING_COORDINATES')).length,
    possibleDuplicates: all.filter((item) => item.issues.includes('POSSIBLE_DUPLICATE')).length,
    stalePlaces: all.filter((item) => item.issues.includes('STALE_PLACE')).length,
    staleImages: all.filter((item) => item.issues.includes('STALE_IMAGES')).length,
    averageScore: all.length
      ? Math.round(all.reduce((sum, item) => sum + item.qualityScore, 0) / all.length)
      : 100
  };

  const items = needsAttention
    .sort((a, b) => a.qualityScore - b.qualityScore || Number(b.verifiedAgeDays || 0) - Number(a.verifiedAgeDays || 0))
    .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 300));

  return {
    summary,
    coverage: buildCoverage(all),
    items,
    thresholds: { staleDays: STALE_DAYS, staleImageDays: STALE_IMAGE_DAYS }
  };
}

export async function markPlaceVerified({ placeId, actorUserId }) {
  return withTransaction(async (client) => {
    const before = await capturePlaceSnapshot(placeId, client);
    if (!before) throw new AppError('Place not found.', 404);

    await client.query(
      `UPDATE places
       SET last_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [placeId]
    );

    const after = await capturePlaceSnapshot(placeId, client);
    await recordPlaceRevision({
      placeId,
      action: 'VERIFY',
      beforeSnapshot: before,
      afterSnapshot: after,
      actorUserId,
      reason: 'Xác minh dữ liệu địa điểm còn chính xác'
    }, client);

    return after;
  });
}
