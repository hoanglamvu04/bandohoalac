import { pool } from '../database/pool.js';

const RADIUS_M = 100;
const MAX_PER_SOURCE = 12;
const MIN_SIMILAR_TITLE = 0.78;

export function normalizePropertyPhone(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return /^84\d{9,10}$/.test(digits) ? '0' + digits.slice(2) : digits;
}

export function normalizePropertyTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const pair = a.slice(i, i + 2);
    grams.set(pair, (grams.get(pair) || 0) + 1);
  }
  let common = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2);
    if ((grams.get(pair) || 0) > 0) {
      common += 1;
      grams.set(pair, grams.get(pair) - 1);
    }
  }
  return (2 * common) / (a.length + b.length - 2);
}

export function propertyTitleSimilarity(left, right) {
  const a = normalizePropertyTitle(left);
  const b = normalizePropertyTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));
  let overlap = 0;
  for (const token of tokensA) if (tokensB.has(token)) overlap += 1;
  const union = tokensA.size + tokensB.size - overlap;
  const tokenScore = union ? overlap / union : 0;
  return Math.round((0.6 * tokenScore + 0.4 * diceCoefficient(a, b)) * 100) / 100;
}

// Căn 101 and căn 102 in one building are different real estate units.
// Explicit unit numbers are stronger disambiguators than shared phone/price.
export function propertyUnitKey(title) {
  const normalized = normalizePropertyTitle(title);
  const match = normalized.match(/\b(can|phong|lo|thua)\s*(?:so\s*)?(\d{1,4}[a-z]?)\b/);
  return match ? match[1] + ':' + match[2] : null;
}

function normalizedPositive(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function closeEnough(a, b, tolerance) {
  const left = normalizedPositive(a);
  const right = normalizedPositive(b);
  return left !== null && right !== null &&
    Math.abs(left - right) / Math.max(left, right) <= tolerance;
}

function propertyDetails(source) {
  const realEstate = source?.realEstate || source?.housing || {};
  return {
    transactionType: String(source?.transactionType ||
      source?.listingType || realEstate.transactionType ||
      realEstate.listingType || '').toUpperCase(),
    propertyType: String(source?.propertyType || realEstate.propertyType || '').toUpperCase(),
    areaM2: source?.areaM2 ?? realEstate.areaM2,
    price: source?.totalPriceVnd ?? realEstate.totalPriceVnd,
    rent: source?.monthlyRentVnd ?? source?.monthlyRent ??
      realEstate.monthlyRentVnd ?? realEstate.monthlyRent
  };
}

export function rankPropertyCandidate(candidate, submitted) {
  const samePhone = Boolean(normalizePropertyPhone(candidate.phone)) &&
    normalizePropertyPhone(candidate.phone) === normalizePropertyPhone(submitted.phone);
  const sameTitle = Boolean(normalizePropertyTitle(candidate.name)) &&
    normalizePropertyTitle(candidate.name) === normalizePropertyTitle(submitted.name);
  const titleSimilarity = propertyTitleSimilarity(candidate.name, submitted.name);
  const sourceUnit = propertyUnitKey(candidate.name);
  const targetUnit = propertyUnitKey(submitted.name);
  const differentUnit = Boolean(sourceUnit && targetUnit && sourceUnit !== targetUnit);
  const a = propertyDetails(candidate);
  const b = propertyDetails(submitted);
  const sameTransaction = Boolean(a.transactionType) &&
    a.transactionType === b.transactionType;
  const samePropertyType = Boolean(a.propertyType) &&
    a.propertyType === b.propertyType;
  const similarArea = closeEnough(a.areaM2, b.areaM2, 0.06);
  const similarPrice = sameTransaction && closeEnough(
    a.transactionType === 'SALE' ? a.price : a.rent,
    b.transactionType === 'SALE' ? b.price : b.rent, 0.07
  );
  const distanceM = Number.isFinite(Number(candidate.distanceM))
    ? Math.max(0, Number(candidate.distanceM)) : RADIUS_M + 1;
  const strongTitle = titleSimilarity >= 0.88;
  const matchingProperty = sameTransaction && samePropertyType && similarArea && similarPrice;
  const likely = !differentUnit && samePhone && strongTitle && distanceM <= 25;
  const review = samePhone ||
    (!differentUnit && strongTitle && distanceM <= 35) ||
    (!differentUnit && titleSimilarity >= MIN_SIMILAR_TITLE &&
      matchingProperty && distanceM <= 45);
  const risk = likely ? 'LIKELY_DUPLICATE' : review ? 'REVIEW' : 'NEARBY';
  const evidence = [];
  if (samePhone) evidence.push('SAME_CONTACT');
  if (sameTitle) evidence.push('SAME_TITLE');
  else if (titleSimilarity >= MIN_SIMILAR_TITLE) evidence.push('SIMILAR_TITLE');
  if (sameTransaction) evidence.push('SAME_TRANSACTION');
  if (samePropertyType) evidence.push('SAME_PROPERTY_TYPE');
  if (similarArea) evidence.push('SIMILAR_AREA');
  if (similarPrice) evidence.push('SIMILAR_PRICE');
  if (differentUnit) evidence.push('DIFFERENT_UNIT');
  if (distanceM <= 25) evidence.push('WITHIN_25M');
  const confidence = Math.max(0, Math.min(100, Math.round(
    (samePhone ? 28 : 0) + 24 * titleSimilarity +
    (sameTransaction ? 6 : 0) + (samePropertyType ? 7 : 0) +
    (similarArea ? 8 : 0) + (similarPrice ? 8 : 0) +
    (distanceM <= 25 ? 16 : distanceM <= 50 ? 10 : 3) -
    (differentUnit ? 45 : 0)
  )));

  return {
    ...candidate,
    samePhone,
    sameTitle,
    titleSimilarity,
    sameTransaction,
    samePropertyType,
    similarArea,
    similarPrice,
    differentUnit,
    confidence,
    evidence,
    risk
  };
}

// Read-only, bounded suggestions. Same address or coordinates alone MUST
// NOT reject multiple apartments, rooms or land plots.
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
    return { items: [], requiresReview: false, radiusM: RADIUS_M, version: 3 };
  }

  const { rows: published } = await client.query(
    `SELECT p.id, p.name, p.address, p.phone,
            hl.listing_type, hl.property_type, hl.area_m2,
            hl.total_price_vnd, hl.monthly_rent,
            ROUND(ST_Distance(p.location::geography,
              ST_SetSRID(ST_MakePoint($1,$2),4326)::geography))::int AS distance_m
       FROM places p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN housing_listings hl ON hl.place_id = p.id
      WHERE p.status = 'PUBLISHED'
        AND c.slug = 'bat-dong-san'
        AND (hl.listing_status IS NULL OR hl.listing_status = 'ACTIVE')
        AND (hl.expires_at IS NULL OR hl.expires_at > NOW())
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
            ct.payload #>> '{place,realEstate,transactionType}' AS listing_type,
            ct.payload #>> '{place,realEstate,propertyType}' AS property_type,
            ct.payload #>> '{place,realEstate,areaM2}' AS area_m2,
            ct.payload #>> '{place,realEstate,totalPriceVnd}' AS total_price_vnd,
            ct.payload #>> '{place,realEstate,monthlyRentVnd}' AS monthly_rent,
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
      distanceM: Number(row.distance_m),
      listingType: row.listing_type,
      propertyType: row.property_type,
      areaM2: row.area_m2,
      totalPriceVnd: row.total_price_vnd,
      monthlyRent: row.monthly_rent
    })),
    ...pending.map((row) => ({
      id: Number(row.contribution_id),
      source: 'PENDING',
      name: row.name,
      address: row.address,
      phone: row.phone,
      distanceM: Number(row.distance_m),
      listingType: row.listing_type,
      propertyType: row.property_type,
      areaM2: row.area_m2,
      totalPriceVnd: row.total_price_vnd,
      monthlyRent: row.monthly_rent
    }))
  ].map((candidate) => rankPropertyCandidate(candidate, place));

  const riskOrder = { LIKELY_DUPLICATE: 0, REVIEW: 1, NEARBY: 2 };
  candidates.sort((a, b) =>
    riskOrder[a.risk] - riskOrder[b.risk] ||
    b.confidence - a.confidence ||
    a.distanceM - b.distanceM ||
    b.id - a.id
  );

  return {
    items: candidates,
    requiresReview: candidates.some((candidate) => candidate.risk !== 'NEARBY'),
    radiusM: RADIUS_M,
    version: 3
  };
}
