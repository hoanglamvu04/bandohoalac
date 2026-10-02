import { pool, withTransaction } from '../database/pool.js';
import {
  SERVICE_AREA_GEOJSON_STRING,
  isInsideServiceCoverage
} from '../config/mapCoverage.js';
import { AppError } from '../utils/AppError.js';
import { generateUniqueSlug } from './place.service.js';

const SOURCE_OVERTURE = 'OVERTURE';

const CATEGORY_RULES = [
  {
    slug: 'truong-hoc',
    terms: [
      'school', 'education', 'educational_institution', 'university', 'college',
      'kindergarten', 'preschool', 'primary_school', 'secondary_school',
      'high_school', 'language_school', 'training_center'
    ]
  },
  {
    slug: 'y-te',
    terms: [
      'health_and_medical', 'hospital', 'clinic', 'medical_clinic', 'doctor',
      'dentist', 'dental_clinic', 'pharmacy', 'drugstore', 'laboratory',
      'medical_center', 'veterinary_clinic'
    ]
  },
  {
    slug: 'sieu-thi',
    terms: [
      'supermarket', 'grocery_store', 'convenience_store', 'department_store',
      'shopping_center', 'shopping_mall', 'market', 'retail', 'store'
    ]
  },
  {
    slug: 'ngan-hang-atm',
    terms: [
      'bank', 'atm', 'financial_service', 'credit_union', 'money_transfer',
      'currency_exchange'
    ]
  },
  {
    slug: 'nhien-lieu-sac',
    terms: [
      'gas_station', 'petrol_station', 'fuel_station', 'service_station',
      'electric_vehicle_charging_station', 'ev_charging_station',
      'charging_station'
    ]
  },
  {
    slug: 'co-quan',
    terms: [
      'government', 'government_office', 'public_service', 'city_hall',
      'town_hall', 'police', 'police_station', 'fire_station', 'courthouse',
      'post_office', 'embassy'
    ]
  },
  {
    slug: 'the-thao',
    terms: [
      'sports_and_recreation', 'sports_center', 'sports_complex', 'gym',
      'fitness_center', 'stadium', 'soccer_field', 'football_field',
      'tennis_court', 'badminton_court', 'basketball_court', 'swimming_pool',
      'golf_course', 'martial_arts'
    ]
  },
  {
    slug: 'giao-thong',
    terms: [
      'transportation', 'bus_station', 'bus_stop', 'train_station',
      'railway_station', 'taxi_stand', 'parking', 'parking_lot',
      'airport', 'ferry_terminal', 'transit_station'
    ]
  },
  {
    slug: 'bat-dong-san',
    terms: [
      'real_estate', 'real_estate_agency', 'real_estate_agent',
      'property_management', 'property_developer', 'housing_development',
      'apartment_complex'
    ]
  },
  {
    slug: 'dich-vu',
    terms: [
      'professional_services', 'local_service', 'service', 'repair_service',
      'auto_repair', 'car_repair', 'motorcycle_repair', 'laundry',
      'dry_cleaning', 'hair_salon', 'beauty_salon', 'barber', 'spa',
      'printing_service', 'photography_service'
    ]
  },
  {
    slug: 'cafe',
    terms: [
      'cafe', 'coffee', 'coffee_shop', 'coffeehouse', 'tea_room',
      'tea_house', 'bubble_tea', 'juice_bar', 'dessert_shop', 'bakery'
    ]
  },
  {
    slug: 'villa',
    terms: [
      'villa', 'resort', 'holiday_home', 'vacation_home', 'cottage',
      'chalet', 'serviced_apartment'
    ]
  },
  {
    slug: 'homestay',
    terms: [
      'homestay', 'hostel', 'guest_house', 'guesthouse', 'bed_and_breakfast',
      'lodging', 'hotel', 'motel', 'inn', 'vacation_rental', 'farmstay'
    ]
  },
  {
    slug: 'an-uong',
    terms: [
      'food_and_drink', 'restaurant', 'eatery', 'casual_eatery', 'fast_food',
      'food_court', 'pizza_restaurant', 'seafood_restaurant', 'steakhouse',
      'barbecue_restaurant', 'vietnamese_restaurant', 'noodle_restaurant',
      'ice_cream_shop', 'bar', 'pub'
    ]
  },
  {
    slug: 'khu-du-lich',
    terms: [
      'tourist_destination', 'tourism_area', 'tourism_complex', 'resort_area',
      'recreation_area', 'recreation_center', 'amusement_park', 'theme_park',
      'water_park', 'eco_tourism', 'eco_park', 'holiday_park',
      'visitor_attraction_complex'
    ]
  },
  {
    slug: 'check-in',
    terms: [
      'tourist_attraction', 'attraction', 'viewpoint', 'landmark', 'monument',
      'scenic_viewpoint', 'park', 'garden', 'lake', 'cultural_and_historic',
      'historic_site'
    ]
  },
  {
    slug: 'trai-nghiem',
    terms: [
      'arts_and_entertainment', 'museum', 'gallery', 'zoo',
      'campground', 'camp_site', 'event_venue'
    ]
  }
]

function firstUseful(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = firstUseful(item);
      if (resolved) return resolved;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    return firstUseful(
      value.primary ??
      value.common ??
      value.freeform ??
      value.value ??
      null
    );
  }

  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function categoryKey(value) {
  return normalizeText(String(value || '').replace(/_/g, ' ')).replace(/ /g, '_');
}

function categoryMatches(item, rule) {
  return item === rule ||
    item.startsWith(rule + '_') ||
    item.endsWith('_' + rule);
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(/\s+/).filter(Boolean));
}

function nameSimilarity(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  return (2 * intersection) / (left.size + right.size);
}

function normalizePhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '');
}

function normalizeWebsite(value) {
  try {
    const url = new URL(String(value || '').trim());
    return (url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '')).toLowerCase();
  } catch {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }
}

function categoryTerms(feature) {
  const props = feature?.properties || {};
  const taxonomy = props.taxonomy || {};
  return [
    props.basic_category,
    taxonomy.primary,
    ...(Array.isArray(taxonomy.hierarchy) ? taxonomy.hierarchy : []),
    ...(Array.isArray(taxonomy.alternates) ? taxonomy.alternates : []),
    props.categories?.primary,
    ...(Array.isArray(props.categories?.alternate) ? props.categories.alternate : [])
  ]
    .filter(Boolean)
    .map(categoryKey);
}

export function mapOvertureCategory(feature) {
  const terms = categoryTerms(feature);

  for (const rule of CATEGORY_RULES) {
    const normalizedRules = rule.terms.map(categoryKey);
    if (normalizedRules.some((candidate) =>
      terms.some((item) => categoryMatches(item, candidate))
    )) {
      return rule.slug;
    }
  }

  return null;
}

function buildAddress(addresses) {
  const first = Array.isArray(addresses) ? addresses[0] : null;
  if (!first) return null;
  if (first.freeform) return String(first.freeform).trim();

  return [
    first.address_line,
    first.locality,
    first.postcode,
    first.region,
    first.country
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(', ') || null;
}

function featureId(feature) {
  return firstUseful(feature?.id) || firstUseful(feature?.properties?.id);
}

function featureName(feature) {
  const props = feature?.properties || {};
  return firstUseful(props.names?.primary) ||
    firstUseful(props.names?.common) ||
    firstUseful(props.name) ||
    null;
}

export function normalizeOvertureFeature(feature, { minConfidence = 0.55 } = {}) {
  if (!feature || feature.geometry?.type !== 'Point') return null;

  const coords = feature.geometry.coordinates || [];
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (!isInsideServiceCoverage(lng, lat)) return null;

  const props = feature.properties || {};
  const externalId = featureId(feature);
  const name = featureName(feature);
  if (!externalId || !name) return null;

  const confidence = props.confidence === null || props.confidence === undefined
    ? null
    : Number(props.confidence);

  if (Number.isFinite(confidence) && confidence < Number(minConfidence || 0)) {
    return null;
  }

  const operatingStatus = firstUseful(props.operating_status);
  if (operatingStatus === 'permanently_closed') return null;

  return {
    source: SOURCE_OVERTURE,
    externalId: String(externalId),
    name: String(name).trim(),
    basicCategory: firstUseful(props.basic_category) || null,
    taxonomyPrimary: firstUseful(props.taxonomy?.primary) || firstUseful(props.categories?.primary) || null,
    taxonomyHierarchy: Array.isArray(props.taxonomy?.hierarchy)
      ? props.taxonomy.hierarchy
      : [],
    mappedCategorySlug: mapOvertureCategory(feature),
    address: buildAddress(props.addresses),
    phone: firstUseful(props.phones),
    website: firstUseful(props.websites),
    lat,
    lng,
    confidence: Number.isFinite(confidence) ? confidence : null,
    operatingStatus: operatingStatus || null,
    rawPayload: feature
  };
}

async function findExistingByExternalId(record, client = pool) {
  const { rows } = await client.query(
    `SELECT id, name, phone, website, 0::double precision AS distance_m
     FROM places
     WHERE external_source = $1 AND external_id = $2
     LIMIT 1`,
    [record.source, record.externalId]
  );
  return rows[0] || null;
}

async function findNearbyDuplicate(record, client = pool) {
  const { rows } = await client.query(
    `SELECT
       p.id,
       p.name,
       p.phone,
       p.website,
       ST_Distance(
         p.location::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       ) AS distance_m
     FROM places p
     WHERE ST_DWithin(
       p.location::geography,
       ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
       140
     )
     ORDER BY distance_m ASC
     LIMIT 30`,
    [record.lng, record.lat]
  );

  const recordPhone = normalizePhone(record.phone);
  const recordWebsite = normalizeWebsite(record.website);
  let best = null;

  for (const row of rows) {
    const distance = Number(row.distance_m) || 0;
    const similarity = nameSimilarity(record.name, row.name);
    const phoneMatch = Boolean(
      recordPhone &&
      normalizePhone(row.phone) &&
      recordPhone === normalizePhone(row.phone)
    );
    const websiteMatch = Boolean(
      recordWebsite &&
      normalizeWebsite(row.website) &&
      recordWebsite === normalizeWebsite(row.website)
    );

    let duplicate = false;
    let score = similarity;

    if (phoneMatch || websiteMatch) {
      duplicate = distance <= 140;
      score = Math.max(score, 1);
    } else if (normalizeText(record.name) === normalizeText(row.name)) {
      duplicate = distance <= 100;
      score = Math.max(score, 0.98);
    } else if (similarity >= 0.84 && distance <= 70) {
      duplicate = true;
    } else if (similarity >= 0.72 && distance <= 35) {
      duplicate = true;
    }

    if (duplicate && (!best || score > best.score || distance < best.distance)) {
      best = {
        id: row.id,
        name: row.name,
        distance,
        score
      };
    }
  }

  return best;
}

async function findDuplicate(record, client = pool) {
  return (
    await findExistingByExternalId(record, client) ||
    await findNearbyDuplicate(record, client)
  );
}

function suggestedImportStatus(record, duplicate) {
  if (duplicate) return 'DUPLICATE';
  if (!record.mappedCategorySlug) return 'REVIEW';
  if (record.confidence === null) return 'REVIEW';
  if (record.operatingStatus === 'temporarily_closed') return 'REVIEW';
  return 'NEW';
}

export async function stageOvertureFeatures(features, {
  minConfidence = 0.55,
  client = pool
} = {}) {
  const stats = {
    received: Array.isArray(features) ? features.length : 0,
    staged: 0,
    new: 0,
    review: 0,
    duplicates: 0,
    skipped: 0
  };

  for (const feature of Array.isArray(features) ? features : []) {
    const record = normalizeOvertureFeature(feature, { minConfidence });
    if (!record) {
      stats.skipped += 1;
      continue;
    }

    const duplicate = await findDuplicate(record, client);
    const nextStatus = suggestedImportStatus(record, duplicate);

    const { rows } = await client.query(
      `INSERT INTO imported_places (
         source, external_id, name, basic_category, taxonomy_primary,
         taxonomy_hierarchy, mapped_category_slug, address, phone, website,
         location, confidence, operating_status, raw_payload,
         duplicate_of_place_id, import_status, last_seen_at, updated_at
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         ST_SetSRID(ST_MakePoint($11,$12),4326),
         $13,$14,$15,$16,$17,NOW(),NOW()
       )
       ON CONFLICT (source, external_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         basic_category = EXCLUDED.basic_category,
         taxonomy_primary = EXCLUDED.taxonomy_primary,
         taxonomy_hierarchy = EXCLUDED.taxonomy_hierarchy,
         mapped_category_slug = COALESCE(imported_places.mapped_category_slug, EXCLUDED.mapped_category_slug),
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         website = EXCLUDED.website,
         location = EXCLUDED.location,
         confidence = EXCLUDED.confidence,
         operating_status = EXCLUDED.operating_status,
         raw_payload = EXCLUDED.raw_payload,
         duplicate_of_place_id = EXCLUDED.duplicate_of_place_id,
         import_status = CASE
           WHEN imported_places.import_status IN ('APPROVED','REJECTED')
             THEN imported_places.import_status
           ELSE EXCLUDED.import_status
         END,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING import_status`,
      [
        record.source,
        record.externalId,
        record.name,
        record.basicCategory,
        record.taxonomyPrimary,
        JSON.stringify(record.taxonomyHierarchy || []),
        record.mappedCategorySlug,
        record.address,
        record.phone,
        record.website,
        record.lng,
        record.lat,
        record.confidence,
        record.operatingStatus,
        JSON.stringify(record.rawPayload || {}),
        duplicate?.id || null,
        nextStatus
      ]
    );

    const finalStatus = rows[0]?.import_status || nextStatus;
    stats.staged += 1;
    if (finalStatus === 'NEW') stats.new += 1;
    else if (finalStatus === 'REVIEW') stats.review += 1;
    else if (finalStatus === 'DUPLICATE') stats.duplicates += 1;
  }

  return stats;
}

function mapImportedRow(row) {
  return {
    id: String(row.id),
    source: row.source,
    externalId: row.external_id,
    name: row.name,
    basicCategory: row.basic_category,
    taxonomyPrimary: row.taxonomy_primary,
    taxonomyHierarchy: Array.isArray(row.taxonomy_hierarchy) ? row.taxonomy_hierarchy : [],
    mappedCategorySlug: row.mapped_category_slug,
    address: row.address,
    phone: row.phone,
    website: row.website,
    lat: Number(row.lat),
    lng: Number(row.lng),
    confidence: row.confidence === null ? null : Number(row.confidence),
    operatingStatus: row.operating_status,
    duplicateOfPlaceId: row.duplicate_of_place_id ? String(row.duplicate_of_place_id) : null,
    duplicatePlaceName: row.duplicate_place_name || null,
    importStatus: row.import_status,
    approvedPlaceId: row.approved_place_id ? String(row.approved_place_id) : null,
    importedAt: row.imported_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at
  };
}

export async function listImportedPlaces({
  q,
  status = 'ALL',
  minConfidence,
  limit = 100,
  offset = 0
} = {}) {
  const conditions = [
    "ip.source = 'OVERTURE'",
    'ST_Intersects(ip.location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))'
  ];
  const params = [SERVICE_AREA_GEOJSON_STRING];

  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('ip.import_status = $' + params.length);
  }

  if (q) {
    params.push('%' + String(q).trim() + '%');
    const ref = '$' + params.length;
    conditions.push(
      '(ip.name ILIKE ' + ref +
      ' OR COALESCE(ip.address, \'\') ILIKE ' + ref +
      ' OR COALESCE(ip.basic_category, \'\') ILIKE ' + ref +
      ' OR COALESCE(ip.taxonomy_primary, \'\') ILIKE ' + ref + ')'
    );
  }

  if (minConfidence !== undefined && minConfidence !== null && minConfidence !== '') {
    params.push(Number(minConfidence));
    conditions.push('ip.confidence >= $' + params.length);
  }

  params.push(Math.min(Math.max(Number(limit) || 100, 1), 300));
  const limitRef = '$' + params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetRef = '$' + params.length;

  const { rows } = await pool.query(
    `SELECT
       ip.*,
       ST_X(ip.location) AS lng,
       ST_Y(ip.location) AS lat,
       dp.name AS duplicate_place_name
     FROM imported_places ip
     LEFT JOIN places dp ON dp.id = ip.duplicate_of_place_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE ip.import_status
         WHEN 'NEW' THEN 1
         WHEN 'REVIEW' THEN 2
         WHEN 'DUPLICATE' THEN 3
         WHEN 'APPROVED' THEN 4
         ELSE 5
       END,
       ip.confidence DESC NULLS LAST,
       ip.updated_at DESC
     LIMIT ${limitRef} OFFSET ${offsetRef}`,
    params
  );

  return rows.map(mapImportedRow);
}

export async function getImportedPlacesStats() {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE import_status = 'NEW')::int AS new_count,
       COUNT(*) FILTER (WHERE import_status = 'REVIEW')::int AS review_count,
       COUNT(*) FILTER (WHERE import_status = 'DUPLICATE')::int AS duplicate_count,
       COUNT(*) FILTER (WHERE import_status = 'APPROVED')::int AS approved_count,
       COUNT(*) FILTER (WHERE import_status = 'REJECTED')::int AS rejected_count,
       COUNT(*) FILTER (
         WHERE import_status = 'NEW'
           AND mapped_category_slug IS NOT NULL
           AND confidence >= 0.8
       )::int AS ready_high_confidence
     FROM imported_places
     WHERE source = 'OVERTURE'
       AND ST_Intersects(location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))`,
    [SERVICE_AREA_GEOJSON_STRING]
  );

  const row = rows[0] || {};
  return {
    total: Number(row.total) || 0,
    new: Number(row.new_count) || 0,
    review: Number(row.review_count) || 0,
    duplicates: Number(row.duplicate_count) || 0,
    approved: Number(row.approved_count) || 0,
    rejected: Number(row.rejected_count) || 0,
    readyHighConfidence: Number(row.ready_high_confidence) || 0
  };
}

export async function updateImportedPlace(id, fields = {}) {
  const allowed = {
    name: 'name',
    address: 'address',
    phone: 'phone',
    website: 'website',
    mappedCategorySlug: 'mapped_category_slug'
  };

  const clauses = [];
  const params = [];

  for (const [input, column] of Object.entries(allowed)) {
    if (fields[input] === undefined) continue;
    params.push(fields[input] || null);
    clauses.push(column + ' = $' + params.length);
  }

  if (!clauses.length) {
    throw new AppError('No supported import fields were provided.', 400);
  }

  params.push(Number(id));
  const idRef = '$' + params.length;

  const firstUpdate = await pool.query(
    `UPDATE imported_places
     SET ${clauses.join(', ')},
         updated_at = NOW()
     WHERE id = ${idRef}
       AND source = 'OVERTURE'
     RETURNING id`,
    params
  );

  if (!firstUpdate.rows[0]) throw new AppError('Imported place not found.', 404);

  const { rows } = await pool.query(
    `UPDATE imported_places
     SET import_status = CASE
       WHEN import_status IN ('APPROVED','REJECTED','DUPLICATE') THEN import_status
       WHEN mapped_category_slug IS NULL THEN 'REVIEW'
       ELSE 'NEW'
     END,
     updated_at = NOW()
     WHERE id = $1
     RETURNING
       *,
       ST_X(location) AS lng,
       ST_Y(location) AS lat`,
    [Number(id)]
  );

  return mapImportedRow(rows[0]);
}

async function approveImportedPlaceInTransaction(id, reviewerId, client) {
  const { rows } = await client.query(
    `SELECT
       ip.*,
       ST_X(ip.location) AS lng,
       ST_Y(ip.location) AS lat
     FROM imported_places ip
     WHERE ip.id = $1 AND ip.source = 'OVERTURE'
     FOR UPDATE`,
    [Number(id)]
  );

  const item = rows[0];
  if (!item) throw new AppError('Imported place not found.', 404);

  if (item.import_status === 'APPROVED' && item.approved_place_id) {
    return {
      importedPlaceId: String(item.id),
      placeId: String(item.approved_place_id),
      alreadyApproved: true
    };
  }

  if (item.import_status === 'DUPLICATE' || item.duplicate_of_place_id) {
    throw new AppError('This imported place matches an existing Hola Maps place.', 409);
  }

  if (!item.mapped_category_slug) {
    throw new AppError('Map this place to a Hola Maps category before approving it.', 400);
  }

  const categoryResult = await client.query(
    'SELECT id FROM categories WHERE slug = $1 LIMIT 1',
    [item.mapped_category_slug]
  );
  const categoryId = categoryResult.rows[0]?.id;
  if (!categoryId) {
    throw new AppError('Mapped Hola Maps category does not exist.', 400);
  }

  const existingExternal = await client.query(
    `SELECT id
     FROM places
     WHERE external_source = 'OVERTURE' AND external_id = $1
     LIMIT 1`,
    [item.external_id]
  );

  let placeId = existingExternal.rows[0]?.id || null;

  if (!placeId) {
    const slug = await generateUniqueSlug(item.name, client);
    const inserted = await client.query(
      `INSERT INTO places (
         name, slug, description, category_id, address, location,
         phone, website, status, source, created_by,
         external_source, external_id, source_confidence, last_source_sync_at
       )
       VALUES (
         $1,$2,NULL,$3,$4,
         ST_SetSRID(ST_MakePoint($5,$6),4326),
         $7,$8,'PUBLISHED','OVERTURE',$9,
         'OVERTURE',$10,$11,NOW()
       )
       RETURNING id`,
      [
        item.name,
        slug,
        categoryId,
        item.address,
        Number(item.lng),
        Number(item.lat),
        item.phone,
        item.website,
        reviewerId || null,
        item.external_id,
        item.confidence
      ]
    );
    placeId = inserted.rows[0].id;
  }

  await client.query(
    `UPDATE imported_places
     SET import_status = 'APPROVED',
         approved_place_id = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [Number(id), placeId, reviewerId || null]
  );

  return {
    importedPlaceId: String(item.id),
    placeId: String(placeId),
    alreadyApproved: false
  };
}

export async function approveImportedPlace(id, reviewerId) {
  return withTransaction((client) =>
    approveImportedPlaceInTransaction(id, reviewerId, client)
  );
}

export async function rejectImportedPlace(id, reviewerId) {
  const { rows } = await pool.query(
    `UPDATE imported_places
     SET import_status = 'REJECTED',
         reviewed_by = $2,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND source = 'OVERTURE'
       AND import_status <> 'APPROVED'
     RETURNING id`,
    [Number(id), reviewerId || null]
  );

  if (!rows[0]) throw new AppError('Imported place not found or already approved.', 404);
  return { id: String(rows[0].id), importStatus: 'REJECTED' };
}

export async function approveHighConfidenceImportedPlaces({
  reviewerId,
  minConfidence = 0.8,
  limit = 200
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);
  const threshold = Math.min(Math.max(Number(minConfidence) || 0.8, 0), 1);

  const { rows } = await pool.query(
    `SELECT id
     FROM imported_places
     WHERE source = 'OVERTURE'
       AND import_status = 'NEW'
       AND duplicate_of_place_id IS NULL
       AND mapped_category_slug IS NOT NULL
       AND confidence >= $1
     ORDER BY confidence DESC NULLS LAST, id ASC
     LIMIT $2`,
    [threshold, safeLimit]
  );

  const approved = [];
  const failed = [];

  for (const row of rows) {
    try {
      approved.push(await approveImportedPlace(row.id, reviewerId));
    } catch (error) {
      failed.push({ id: String(row.id), error: error.message });
    }
  }

  return {
    threshold,
    requested: rows.length,
    approvedCount: approved.length,
    failedCount: failed.length,
    approved,
    failed
  };
}
