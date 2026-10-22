import { pool } from '../database/pool.js';

const FPT_LNG = 105.52522;
const FPT_LAT = 21.01354;

function booleanValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapHousingRow(row) {
  if (!row) return null;

  const hasStructuredHousing = row.housing_place_id !== null && row.housing_place_id !== undefined;

  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    address: row.address,
    phone: row.phone,
    website: row.website,
    priceLevel: row.price_level,
    openingHours: row.opening_hours,
    rating: Number(row.rating_avg) || 0,
    reviews: Number(row.rating_count) || 0,
    lat: Number(row.lat),
    lng: Number(row.lng),
    category: row.category || 'Bất động sản',
    categorySlug: row.category_slug || 'bat-dong-san',
    isPartner: Boolean(row.is_partner),
    partnerName: row.partner_name || null,
    images: Array.isArray(row.images) ? row.images : [],
    thumbnails: Array.isArray(row.thumbnails) ? row.thumbnails : [],
    cardImages: Array.isArray(row.card_images) ? row.card_images : [],
    distanceToFptM: Number(row.distance_to_fpt_m) || 0,
    updatedAt: row.updated_at,
    housing: hasStructuredHousing ? {
      monthlyRent: numberOrNull(row.monthly_rent),
      depositAmount: numberOrNull(row.deposit_amount),
      areaM2: numberOrNull(row.area_m2),
      availabilityStatus: row.availability_status || 'UNKNOWN',
      availableRooms: numberOrNull(row.available_rooms),
      totalRooms: numberOrNull(row.total_rooms),
      electricityPricePerKwh: numberOrNull(row.electricity_price_per_kwh),
      waterPricePerPersonMonth: numberOrNull(row.water_price_per_person_month),
      parkingFeeMonthly: numberOrNull(row.parking_fee_monthly),
      hasAirConditioner: row.has_air_conditioner,
      hasWaterHeater: row.has_water_heater,
      hasPrivateBathroom: row.has_private_bathroom,
      hasLoft: row.has_loft,
      hasBalcony: row.has_balcony,
      hasParking: row.has_parking,
      allowsPets: row.allows_pets,
      curfewNote: row.curfew_note || null,
      availabilityNote: row.availability_note || null,
      contactZalo: row.contact_zalo || null,
      availableFrom: row.available_from || null,
      lastVerifiedAt: row.housing_last_verified_at || null,
      verificationSource: row.verification_source || 'COMMUNITY'
    } : null
  };
}

const BASE_SELECT = `
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.address,
    p.phone,
    p.website,
    p.price_level,
    p.opening_hours,
    p.rating_avg,
    p.rating_count,
    p.updated_at,
    ST_X(p.location) AS lng,
    ST_Y(p.location) AS lat,
    c.name AS category,
    c.slug AS category_slug,
    EXISTS (
      SELECT 1
      FROM place_partners pp
      WHERE pp.place_id = p.id
        AND pp.status = 'ACTIVE'
    ) AS is_partner,
    (
      SELECT pp.partner_name
      FROM place_partners pp
      WHERE pp.place_id = p.id
        AND pp.status = 'ACTIVE'
      LIMIT 1
    ) AS partner_name,
    COALESCE((
      SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC)
      FROM place_images pi
      WHERE pi.place_id = p.id
    ), '[]'::json) AS images,
    COALESCE((
      SELECT json_agg(COALESCE(pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC)
      FROM place_images pi
      WHERE pi.place_id = p.id
    ), '[]'::json) AS thumbnails,
    COALESCE((
      SELECT json_agg(COALESCE(pi.card_url, pi.thumbnail_url, pi.url) ORDER BY pi.is_cover DESC, pi.id ASC)
      FROM place_images pi
      WHERE pi.place_id = p.id
    ), '[]'::json) AS card_images,
    ROUND(ST_Distance(
      p.location::geography,
      ST_SetSRID(ST_MakePoint(105.52522, 21.01354), 4326)::geography
    ))::int AS distance_to_fpt_m,
    hl.place_id AS housing_place_id,
    hl.monthly_rent,
    hl.deposit_amount,
    hl.area_m2,
    hl.availability_status,
    hl.available_rooms,
    hl.total_rooms,
    hl.electricity_price_per_kwh,
    hl.water_price_per_person_month,
    hl.parking_fee_monthly,
    hl.has_air_conditioner,
    hl.has_water_heater,
    hl.has_private_bathroom,
    hl.has_loft,
    hl.has_balcony,
    hl.has_parking,
    hl.allows_pets,
    hl.curfew_note,
    hl.availability_note,
    hl.contact_zalo,
    hl.available_from,
    hl.last_verified_at AS housing_last_verified_at,
    hl.verification_source
  FROM places p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN housing_listings hl ON hl.place_id = p.id
`;

export async function listHousingListings(filters = {}) {
  const conditions = [
    "p.status = 'PUBLISHED'",
    "c.slug = 'bat-dong-san'"
  ];
  const params = [];

  if (filters.q) {
    params.push(String(filters.q).trim());
    const ref = '$' + params.length;
    const folded = 'lower(public.hola_unaccent(' + ref + '))';
    conditions.push(
      "(lower(public.hola_unaccent(COALESCE(p.name, '') || ' ' || COALESCE(p.address, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(hl.availability_note, '') || ' ' || COALESCE(hl.curfew_note, ''))) LIKE '%' || " + folded + " || '%')"
    );
  }

  const numericFilters = [
    ['minRent', 'hl.monthly_rent >='],
    ['maxRent', 'hl.monthly_rent <='],
    ['minArea', 'hl.area_m2 >='],
    ['maxArea', 'hl.area_m2 <='],
    ['minAvailableRooms', 'hl.available_rooms >=']
  ];

  for (const [key, operator] of numericFilters) {
    if (filters[key] === undefined) continue;
    params.push(Number(filters[key]));
    conditions.push(operator + ' $' + params.length);
  }

  if (filters.maxDistanceFpt !== undefined) {
    params.push(Number(filters.maxDistanceFpt));
    conditions.push(
      `ST_DWithin(
         p.location::geography,
         ST_SetSRID(ST_MakePoint(105.52522, 21.01354), 4326)::geography,
         $${params.length}
       )`
    );
  }

  if (filters.verifiedWithinDays !== undefined) {
    params.push(Number(filters.verifiedWithinDays));
    conditions.push("hl.last_verified_at >= NOW() - ($" + params.length + " * INTERVAL '1 day')");
  }

  if (filters.availability) {
    params.push(filters.availability);
    conditions.push('hl.availability_status = $' + params.length);
  }

  if (booleanValue(filters.availableOnly) === true) {
    conditions.push("hl.availability_status IN ('AVAILABLE', 'LIMITED')");
    conditions.push('COALESCE(hl.available_rooms, 1) > 0');
  }

  const booleanFilters = [
    ['airConditioner', 'hl.has_air_conditioner'],
    ['waterHeater', 'hl.has_water_heater'],
    ['privateBathroom', 'hl.has_private_bathroom'],
    ['loft', 'hl.has_loft'],
    ['balcony', 'hl.has_balcony'],
    ['parking', 'hl.has_parking'],
    ['pets', 'hl.allows_pets']
  ];

  for (const [key, column] of booleanFilters) {
    const value = booleanValue(filters[key]);
    if (value === null) continue;
    params.push(value);
    conditions.push(column + ' = $' + params.length);
  }

  const orderMap = {
    recommended: `is_partner DESC,
      CASE hl.availability_status
        WHEN 'AVAILABLE' THEN 0
        WHEN 'LIMITED' THEN 1
        WHEN 'UNKNOWN' THEN 2
        ELSE 3
      END,
      hl.last_verified_at DESC NULLS LAST,
      p.rating_avg DESC,
      p.updated_at DESC`,
    rent_asc: 'hl.monthly_rent ASC NULLS LAST, p.updated_at DESC',
    rent_desc: 'hl.monthly_rent DESC NULLS LAST, p.updated_at DESC',
    distance: 'distance_to_fpt_m ASC, p.updated_at DESC',
    area_desc: 'hl.area_m2 DESC NULLS LAST, p.updated_at DESC',
    freshest: 'hl.last_verified_at DESC NULLS LAST, p.updated_at DESC'
  };

  const safeLimit = Math.min(Math.max(Number(filters.limit) || 30, 1), 100);
  const safeOffset = Math.max(Number(filters.offset) || 0, 0);
  const sort = orderMap[filters.sort] || orderMap.recommended;

  params.push(safeLimit);
  const limitRef = '$' + params.length;
  params.push(safeOffset);
  const offsetRef = '$' + params.length;

  const sql = BASE_SELECT +
    ' WHERE ' + conditions.join(' AND ') +
    ' ORDER BY ' + sort +
    ' LIMIT ' + limitRef +
    ' OFFSET ' + offsetRef;

  const { rows } = await pool.query(sql, params);
  const items = rows.map(mapHousingRow);

  return {
    items,
    meta: {
      count: items.length,
      structuredCount: items.filter((item) => item.housing).length,
      partnerCount: items.filter((item) => item.isPartner).length,
      fpt: {
        name: 'Trường Đại học FPT',
        lat: FPT_LAT,
        lng: FPT_LNG
      }
    }
  };
}

export async function getHousingListingByPlaceId(placeId) {
  const { rows } = await pool.query(
    BASE_SELECT +
      " WHERE p.id = $1 AND p.status = 'PUBLISHED' AND c.slug = 'bat-dong-san' LIMIT 1",
    [placeId]
  );

  return mapHousingRow(rows[0] || null);
}
