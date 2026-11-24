import { pool } from '../database/pool.js';

// Data-only preflight evidence: no claims about backups, images on object
// storage, mobile UX or operational sign-off can be made from a DB query.
export const LAUNCH_MANUAL_GATES = Object.freeze([
  'OFFSITE_BACKUP_VERIFIED',
  'PRODUCTION_RESTORE_DRILL',
  'REAL_MOBILE_ACCEPTANCE',
  'LEGACY_MEDIA_PRIVACY_REVIEW',
  'LIVE_HTTPS_AND_NGINX',
  'WA005_OPERATOR_APPROVAL'
]);

export async function queryPublicLaunchEvidence(db = pool) {
  const { rows } = await db.query(
    `SELECT
      COUNT(*) FILTER (WHERE p.status='PUBLISHED')::int AS published_places,
      COUNT(*) FILTER (WHERE p.status='PUBLISHED' AND c.slug='bat-dong-san'
        AND hl.place_id IS NOT NULL AND hl.listing_status='ACTIVE'
        AND (hl.expires_at IS NULL OR hl.expires_at > NOW()))::int AS active_housing,
      COUNT(*) FILTER (WHERE p.status='PUBLISHED' AND c.slug='bat-dong-san'
        AND hl.place_id IS NULL)::int AS legacy_unstructured_housing,
      COUNT(*) FILTER (WHERE p.status='PUBLISHED' AND c.slug='bat-dong-san'
        AND hl.place_id IS NOT NULL
        AND (hl.listing_status IS DISTINCT FROM 'ACTIVE'
          OR hl.expires_at <= NOW()))::int AS stale_published_housing,
      COUNT(*) FILTER (WHERE p.status='PUBLISHED' AND c.slug='bat-dong-san'
        AND (p.phone IS NULL OR BTRIM(p.phone)=''))::int AS missing_housing_contact,
      COUNT(*) FILTER (WHERE p.status='PUBLISHED' AND c.slug='bat-dong-san'
        AND hl.place_id IS NOT NULL
        AND (hl.area_m2 IS NULL OR hl.area_m2 <= 0
          OR (hl.listing_type = 'SALE' AND COALESCE(hl.total_price_vnd,0) <= 0)
          OR (hl.listing_type = 'RENT' AND COALESCE(hl.monthly_rent,0) <= 0))
        )::int AS invalid_housing_price_area,
      COUNT(*) FILTER (WHERE p.status='PUBLISHED'
        AND NOT EXISTS (SELECT 1 FROM place_images pi WHERE pi.place_id=p.id))::int
        AS published_without_images
      FROM places p
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN housing_listings hl ON hl.place_id=p.id`
  );
  const item = rows[0] || {};
  const counts = Object.fromEntries([
    ['publishedPlaces','published_places'],
    ['activeHousing','active_housing'],
    ['legacyUnstructuredHousing','legacy_unstructured_housing'],
    ['stalePublishedHousing','stale_published_housing'],
    ['missingHousingContact','missing_housing_contact'],
    ['invalidHousingPriceArea','invalid_housing_price_area'],
    ['publishedWithoutImages','published_without_images']
  ].map(([key,column]) => [key, Math.max(0,Number(item[column]) || 0)]));
  const blockers = [];
  if (!counts.publishedPlaces) blockers.push('NO_PUBLIC_PLACES');
  if (counts.stalePublishedHousing) blockers.push('STALE_PUBLISHED_HOUSING');
  if (counts.missingHousingContact) blockers.push('HOUSING_MISSING_CONTACT');
  if (counts.invalidHousingPriceArea) blockers.push('HOUSING_INVALID_PRICE_AREA');
  if (counts.legacyUnstructuredHousing) blockers.push('LEGACY_UNSTRUCTURED_HOUSING');
  return {
    source: 'READ_ONLY_AGGREGATE_POSTGRES',
    checkedAt: new Date().toISOString(),
    launchStatus: 'NOT_VERIFIED',
    dataGate: blockers.length ? 'NEEDS_REVIEW' : 'NO_BLOCKERS_DETECTED',
    counts,
    blockers,
    manualGates: LAUNCH_MANUAL_GATES.map((key) => ({ code:key,status:'UNVERIFIED' })),
    disclaimer: 'Đây chỉ là bằng chứng chất lượng dữ liệu. CI xanh hoặc API khỏe không xác nhận VPS sẵn sàng ra mắt.'
  };
}

export function createLaunchEvidenceCache({ load = queryPublicLaunchEvidence,
  now = () => Date.now(), ttlMs = 60000 } = {}) {
  let cached = null;
  let expires = 0;
  let pending = null;
  return async function fetchEvidence() {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = Promise.resolve().then(load)
      .then((result) => {
        cached = result;
        expires = now() + ttlMs;
        return result;
      }).finally(() => { pending = null; });
    return pending;
  };
}
export const getLaunchEvidenceCached = createLaunchEvidenceCache();
