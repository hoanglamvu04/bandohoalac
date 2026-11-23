import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { getHousingListingByPlaceId } from './housing.service.js';

export const SAVED_HOUSING_SEARCH_LIMIT = 12;

function mapSavedSearch(row) {
  return {
    id: String(row.id),
    name: row.name,
    filters: row.filters || {},
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// This endpoint only reveals already published, active, non-expired housing.
export async function compareHousingListings(ids, getListing = getHousingListingByPlaceId) {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 ||
      new Set(ids.map(String)).size !== ids.length ||
      ids.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
    throw new AppError('Chọn từ 2 đến 4 tin bất động sản khác nhau.', 400);
  }
  const fetched = await Promise.all(ids.map((id) => getListing(Number(id))));
  const items = fetched.filter(Boolean).map((item) => {
    const area = Number(item.housing?.areaM2);
    const isSale = item.housing?.listingType === 'SALE';
    const price = isSale ? Number(item.housing?.totalPriceVnd)
      : Number(item.housing?.monthlyRent);
    // No invented valuation: absent/invalid price or area => null.
    const pricePerM2Vnd = item.housing?.areaM2 != null &&
      (isSale ? item.housing?.totalPriceVnd != null : item.housing?.monthlyRent != null) &&
      Number.isFinite(area) && area > 0 && Number.isFinite(price) && price > 0
      ? Math.round(price / area) : null;
    return { ...item, pricePerM2Vnd };
  });
  return {
    items,
    unavailableCount: ids.length - items.length,
    comparisonBasis: 'published_active_only',
    distanceNote: 'Khoảng cách tới FPT là đường chim bay, không phải thời gian lái xe.'
  };
}

export async function listSavedHousingSearches(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, name, filters, enabled, created_at, updated_at
       FROM housing_saved_searches
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 12`, [userId]
  );
  return rows.map(mapSavedSearch);
}

export async function saveHousingSearch(userId, { name, filters }, transaction = withTransaction) {
  return transaction(async (client) => {
    // Serializes concurrent saves by the same user, enforcing the 12-search
    // quota without relying on an app-server-local process lock.
    const userLock = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!userLock.rowCount) throw new AppError('Tài khoản không còn tồn tại.', 401);
    const count = await client.query(
      'SELECT COUNT(*)::int AS count FROM housing_saved_searches WHERE user_id = $1', [userId]
    );
    if (Number(count.rows[0]?.count) >= SAVED_HOUSING_SEARCH_LIMIT) {
      throw new AppError('Bạn đã lưu tối đa 12 bộ lọc. Hãy xóa bớt trước khi lưu mới.', 409);
    }
    const { rows } = await client.query(
      `INSERT INTO housing_saved_searches (user_id, name, filters)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, name, filters, enabled, created_at, updated_at`,
      [userId, name, JSON.stringify(filters)]
    );
    return mapSavedSearch(rows[0]);
  });
}

export async function setSavedHousingSearchEnabled(userId, id, enabled, db = pool) {
  const { rows } = await db.query(
    `UPDATE housing_saved_searches
        SET active_since = CASE
              WHEN $3 = TRUE AND enabled = FALSE THEN NOW()
              ELSE active_since END,
            enabled = $3, updated_at = NOW(),
            -- Disabled periods are not backfilled when the user resumes.
            last_checked_at = CASE WHEN $3 = TRUE THEN NOW() ELSE last_checked_at END
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, filters, enabled, created_at, updated_at`,
    [id, userId, enabled]
  );
  if (!rows.length) throw new AppError('Không tìm thấy bộ lọc của bạn.', 404);
  return mapSavedSearch(rows[0]);
}

export async function deleteSavedHousingSearch(userId, id, db = pool) {
  const result = await db.query(
    'DELETE FROM housing_saved_searches WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  if (!result.rows.length) throw new AppError('Không tìm thấy bộ lọc của bạn.', 404);
  return { ok: true };
}

// Run by a separately scheduled backend cron. Unlike a client-side poll,
// this only fires after an actual PENDING -> PUBLISHED transition stamped in
// PostgreSQL. It never sends email, pushes GPS, or exports filters to X-HUB.
export async function generateSavedHousingAlerts(db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock(84500173::bigint) AS acquired');
    if (lock.rows[0]?.acquired !== true) {
      await client.query('ROLLBACK');
      return { created: 0, skipped: true };
    }
    const { rows: clock } = await client.query('SELECT statement_timestamp() AS scan_at');
    const scanAt = clock[0].scan_at;

    const { rows } = await client.query(`
      WITH matches AS (
        SELECT s.user_id, s.id AS search_id, p.id AS place_id, p.name AS place_name
        FROM housing_saved_searches s
        JOIN users u ON u.id = s.user_id AND u.account_status = 'ACTIVE'
        JOIN places p
          ON p.status = 'PUBLISHED'
         -- Overlap the last 24 hours: a review transaction may stamp its
         -- publication before the scan and commit just afterward.
         -- A unique notification index safely deduplicates repeated scans.
         AND p.housing_published_at >
           GREATEST(s.created_at,
             COALESCE(s.last_checked_at - INTERVAL '24 hours', s.created_at))
         AND p.housing_published_at <= $1::timestamptz
        JOIN categories c ON c.id = p.category_id AND c.slug = 'bat-dong-san'
        JOIN housing_listings hl ON hl.place_id = p.id
          AND hl.listing_status = 'ACTIVE'
          AND (hl.expires_at IS NULL OR hl.expires_at > $1::timestamptz)
        WHERE s.enabled = TRUE
          AND (NOT (s.filters ? 'listingType') OR hl.listing_type = s.filters->>'listingType')
          AND (NOT (s.filters ? 'propertyType') OR hl.property_type = s.filters->>'propertyType')
          AND (NOT (s.filters ? 'minPrice') OR hl.total_price_vnd >= (s.filters->>'minPrice')::numeric)
          AND (NOT (s.filters ? 'maxPrice') OR hl.total_price_vnd <= (s.filters->>'maxPrice')::numeric)
          AND (NOT (s.filters ? 'minRent') OR hl.monthly_rent >= (s.filters->>'minRent')::numeric)
          AND (NOT (s.filters ? 'maxRent') OR hl.monthly_rent <= (s.filters->>'maxRent')::numeric)
          AND (NOT (s.filters ? 'minArea') OR hl.area_m2 >= (s.filters->>'minArea')::numeric)
          AND (NOT (s.filters ? 'maxArea') OR hl.area_m2 <= (s.filters->>'maxArea')::numeric)
          AND (NOT (s.filters ? 'availability') OR hl.availability_status = s.filters->>'availability')
          AND (NOT (s.filters ? 'availableOnly') OR s.filters->>'availableOnly' = 'false'
               OR (hl.availability_status IN ('AVAILABLE','LIMITED')
                   AND COALESCE(hl.available_rooms,1) > 0))
          AND (NOT (s.filters ? 'privateBathroom') OR
               hl.has_private_bathroom = (s.filters->>'privateBathroom')::boolean)
          AND (NOT (s.filters ? 'parking') OR
               hl.has_parking = (s.filters->>'parking')::boolean)
          AND (NOT (s.filters ? 'partnerOnly') OR s.filters->>'partnerOnly' = 'false'
               OR EXISTS (SELECT 1 FROM place_partners pp
                            WHERE pp.place_id = p.id AND pp.status = 'ACTIVE'))
          AND (NOT (s.filters ? 'maxDistanceFpt') OR
               ST_DWithin(p.location::geography,
                  ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326)::geography,
                  (s.filters->>'maxDistanceFpt')::numeric))
          AND (NOT (s.filters ? 'q') OR
               lower(public.hola_unaccent(COALESCE(p.name,'') || ' ' ||
                 COALESCE(p.address,'') || ' ' || COALESCE(p.description,'')))
               LIKE '%' || lower(public.hola_unaccent(s.filters->>'q')) || '%')
      )
      INSERT INTO notifications (user_id, type, title, message, data)
      SELECT m.user_id, 'HOUSING_SAVED_SEARCH_MATCH',
             'Bất động sản mới phù hợp bộ lọc',
             'Có tin đã duyệt mới phù hợp: ' || LEFT(m.place_name, 130),
             jsonb_build_object('placeId',m.place_id::text,
                                'savedSearchId',m.search_id::text)
      FROM matches m
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [scanAt]);
    await client.query(
      `UPDATE housing_saved_searches
          SET last_checked_at = $1::timestamptz
        WHERE enabled = TRUE
          AND (last_checked_at IS NULL OR last_checked_at < $1::timestamptz)`,
      [scanAt]
    );
    await client.query('COMMIT');
    return { created: rows.length, skipped: false };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve primary error */ }
    throw error;
  } finally {
    client.release();
  }
}
