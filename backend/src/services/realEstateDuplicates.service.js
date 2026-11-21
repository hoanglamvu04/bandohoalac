import { pool } from '../database/pool.js';

const RADIUS_M = 100;
const MAX_PER_SOURCE = 12;

export function normalizePropertyPhone(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return /^84\d{9,10}$/.test(digits) ? '0' + digits.slice(2) : digits;
}

function normalizePropertyTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function rankPropertyCandidate(candidate, submitted) {
  const samePhone = Boolean(normalizePropertyPhone(candidate.phone)) &&
    normalizePropertyPhone(candidate.phone) === normalizePropertyPhone(submitted.phone);
  const sameTitle = Boolean(normalizePropertyTitle(candidate.name)) &&
    normalizePropertyTitle(candidate.name) === normalizePropertyTitle(submitted.name);
  const distanceM = Math.max(0, Number(candidate.distanceM || 0));

  return {
    ...candidate,
    samePhone,
    sameTitle,
    risk: samePhone && sameTitle && distanceM <= 25
      ? 'LIKELY_DUPLICATE'
      : (samePhone || (sameTitle && distanceM <= 35))
        ? 'REVIEW'
        : 'NEARBY'
  };
}

// Read-only suggestions. Multiple flats, plots or rooms at the same coordinates
// are legitimate; proximity alone must never be an automatic rejection.
export async function findNearbyPropertyCandidates({
  contributionId,
  payload,
  client = pool
}) {
  const place = payload?.place;
  const location = payload?.location;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!place?.realEstate || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { items: [], requiresReview: false, radiusM: RADIUS_M };
  }

  const { rows: published } = await client.query(
    `SELECT p.id, p.name, p.address, p.phone,
            ROUND(ST_Distance(p.location::geography,
              ST_SetSRID(ST_MakePoint($1,$2),4326)::geography))::int AS distance_m
       FROM places p
       JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'PUBLISHED'
        AND c.slug = 'bat-dong-san'
        AND ST_DWithin(p.location::geography,
          ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
      ORDER BY distance_m ASC, p.id DESC
      LIMIT $4`,
    [lng, lat, RADIUS_M, MAX_PER_SOURCE]
  );

  // Guard coordinate casting with jsonb_typeof: legacy pending contributions
  // may have invalid/missing location fields, which must not break Admin review.
  const { rows: pending } = await client.query(
    `SELECT ct.id AS contribution_id,
            ct.payload #>> '{place,name}' AS name,
            ct.payload #>> '{place,address}' AS address,
            ct.payload #>> '{place,phone}' AS phone,
            ROUND(ST_Distance(
              ST_SetSRID(ST_MakePoint(coords.lng, coords.lat),4326)::geography,
              ST_SetSRID(ST_MakePoint($1,$2),4326)::geography))::int AS distance_m
       FROM contributions ct
       CROSS JOIN LATERAL (
         SELECT
           CASE WHEN jsonb_typeof(ct.payload #> '{location,lng}') = 'number'
             THEN (ct.payload #>> '{location,lng}')::double precision END AS lng,
           CASE WHEN jsonb_typeof(ct.payload #> '{location,lat}') = 'number'
             THEN (ct.payload #>> '{location,lat}')::double precision END AS lat
       ) coords
      WHERE ct.status = 'PENDING'
        AND ct.type = 'CREATE_PLACE'
        AND ct.id <> $4
        AND ct.payload #>> '{place,categorySlug}' = 'bat-dong-san'
        AND ct.payload #> '{place,realEstate}' IS NOT NULL
        AND coords.lat BETWEEN -90 AND 90
        AND coords.lng BETWEEN -180 AND 180
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(coords.lng, coords.lat),4326)::geography,
          ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
      ORDER BY distance_m ASC, ct.id DESC
      LIMIT $5`,
    [lng, lat, RADIUS_M, Number(contributionId) || 0, MAX_PER_SOURCE]
  );

  const candidates = [
    ...published.map((row) => ({
      id: Number(row.id),
      source: 'PUBLISHED',
      name: row.name,
      address: row.address,
      phone: row.phone,
      distanceM: Number(row.distance_m)
    })),
    ...pending.map((row) => ({
      id: Number(row.contribution_id),
      source: 'PENDING',
      name: row.name,
      address: row.address,
      phone: row.phone,
      distanceM: Number(row.distance_m)
    }))
  ].map((candidate) => rankPropertyCandidate(candidate, place));

  const riskOrder = { LIKELY_DUPLICATE: 0, REVIEW: 1, NEARBY: 2 };
  candidates.sort((a, b) =>
    riskOrder[a.risk] - riskOrder[b.risk] ||
    a.distanceM - b.distanceM ||
    b.id - a.id
  );

  return {
    items: candidates,
    requiresReview: candidates.some((candidate) => candidate.risk !== 'NEARBY'),
    radiusM: RADIUS_M
  };
}
