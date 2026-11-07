import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';

export const PLACE_VERIFICATION_STALE_DAYS = 180;
export const PLACE_ACTIVE_CONFIRMATION_COOLDOWN_DAYS = 30;

export function deriveVerificationFreshness(lastVerifiedAt, now = new Date()) {
  if (!lastVerifiedAt) {
    return {
      status: 'UNVERIFIED',
      ageDays: null,
      staleDays: PLACE_VERIFICATION_STALE_DAYS,
      isStale: true
    };
  }

  const verifiedTime = new Date(lastVerifiedAt).getTime();
  const nowTime = new Date(now).getTime();
  if (!Number.isFinite(verifiedTime) || !Number.isFinite(nowTime)) {
    return {
      status: 'UNVERIFIED',
      ageDays: null,
      staleDays: PLACE_VERIFICATION_STALE_DAYS,
      isStale: true
    };
  }

  const ageDays = Math.max(0, Math.floor((nowTime - verifiedTime) / 86400000));
  const isStale = ageDays > PLACE_VERIFICATION_STALE_DAYS;
  return {
    status: isStale ? 'STALE' : 'FRESH',
    ageDays,
    staleDays: PLACE_VERIFICATION_STALE_DAYS,
    isStale
  };
}

export async function getPlaceTrustSummary(placeId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       p.id,
       p.last_verified_at AS place_last_verified_at,
       hola.created_at AS hola_verified_at,
       hola.actor_name AS hola_verified_by,
       legacy.created_at AS legacy_verified_at,
       owner_confirm.created_at AS owner_confirmed_at,
       owner_confirm.actor_name AS owner_confirmed_by,
       community_confirm.created_at AS community_confirmed_at,
       community_confirm.actor_name AS community_confirmed_by,
       (
         SELECT COUNT(*)::int
         FROM place_verification_events e
         WHERE e.place_id = p.id
           AND e.source = 'COMMUNITY'
           AND e.event_type = 'CONFIRMED_ACTIVE'
           AND e.created_at >= NOW() - INTERVAL '90 days'
       ) AS community_confirmations_90d,
       (
         SELECT COUNT(*)::int
         FROM place_verification_events e
         WHERE e.place_id = p.id
           AND e.source = 'COMMUNITY'
           AND e.event_type = 'VERIFIED'
           AND e.created_at >= NOW() - INTERVAL '90 days'
       ) AS community_checks_90d,
       (
         SELECT COUNT(*)::int
         FROM contributions c
         WHERE c.place_id = p.id
           AND c.status = 'APPROVED'
           AND c.created_at >= NOW() - INTERVAL '90 days'
           AND c.type IN (
             'CREATE_PLACE', 'UPDATE_PLACE', 'ADD_PHOTO', 'FIX_LOCATION',
             'UPDATE_HOURS', 'UPDATE_PRICE', 'REPORT_CLOSED', 'REPORT_WRONG_INFO'
           )
       ) AS community_updates_90d,
       (
         SELECT COUNT(*)::int
         FROM contributions c
         WHERE c.place_id = p.id
           AND c.status = 'PENDING'
           AND c.type IN ('REPORT_WRONG_INFO', 'REPORT_CLOSED', 'UPDATE_HOURS', 'FIX_LOCATION')
       ) AS pending_reports
     FROM places p
     LEFT JOIN LATERAL (
       SELECT e.created_at, u.name AS actor_name
       FROM place_verification_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.place_id = p.id
         AND e.source = 'HOLA'
         AND e.event_type = 'VERIFIED'
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 1
     ) hola ON TRUE
     LEFT JOIN LATERAL (
       SELECT e.created_at
       FROM place_verification_events e
       WHERE e.place_id = p.id
         AND e.source = 'LEGACY'
         AND e.event_type = 'VERIFIED'
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 1
     ) legacy ON TRUE
     LEFT JOIN LATERAL (
       SELECT e.created_at, u.name AS actor_name
       FROM place_verification_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.place_id = p.id
         AND e.source = 'OWNER'
         AND e.event_type = 'CONFIRMED_ACTIVE'
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 1
     ) owner_confirm ON TRUE
     LEFT JOIN LATERAL (
       SELECT e.created_at, u.name AS actor_name
       FROM place_verification_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.place_id = p.id
         AND e.source = 'COMMUNITY'
         AND e.event_type = 'CONFIRMED_ACTIVE'
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 1
     ) community_confirm ON TRUE
     WHERE p.id = $1
       AND p.status = 'PUBLISHED'
       AND ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
     LIMIT 1`,
    [placeId, SERVICE_AREA_GEOJSON_STRING]
  );

  const row = rows[0];
  if (!row) return null;

  const legacyCandidates = [row.legacy_verified_at, row.place_last_verified_at]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const legacyVerifiedAt = legacyCandidates[0] || null;
  const useHola = row.hola_verified_at
    && (!legacyVerifiedAt || new Date(row.hola_verified_at) >= new Date(legacyVerifiedAt));
  const lastVerifiedAt = useHola ? row.hola_verified_at : legacyVerifiedAt;
  const verificationSource = useHola ? 'HOLA' : (lastVerifiedAt ? 'LEGACY' : null);

  return {
    placeId: String(row.id),
    lastVerifiedAt,
    verificationSource,
    verifiedBy: useHola ? (row.hola_verified_by || null) : null,
    freshness: deriveVerificationFreshness(lastVerifiedAt),
    owner: {
      lastConfirmedAt: row.owner_confirmed_at || null,
      confirmedBy: row.owner_confirmed_by || null
    },
    community: {
      lastConfirmedAt: row.community_confirmed_at || null,
      confirmedBy: row.community_confirmed_by || null,
      confirmations90d: Number(row.community_confirmations_90d) || 0,
      verifiedChecks90d: Number(row.community_checks_90d) || 0,
      approvedUpdates90d: Number(row.community_updates_90d) || 0,
      pendingReports: Number(row.pending_reports) || 0
    }
  };
}

export async function recordPlaceActiveConfirmation({ placeId, actorUserId }) {
  return withTransaction(async (client) => {
    const { rows: placeRows } = await client.query(
      `SELECT id
       FROM places
       WHERE id = $1
         AND status = 'PUBLISHED'
         AND ST_Intersects(location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
       FOR UPDATE`,
      [placeId, SERVICE_AREA_GEOJSON_STRING]
    );
    if (!placeRows[0]) throw new AppError('Địa điểm không tồn tại hoặc chưa được xuất bản.', 404);

    const managerResult = await client.query(
      `SELECT role
       FROM place_managers
       WHERE place_id = $1 AND user_id = $2 AND role = 'OWNER'
       LIMIT 1`,
      [placeId, actorUserId]
    );
    const source = managerResult.rows[0] ? 'OWNER' : 'COMMUNITY';

    const recent = await client.query(
      `SELECT created_at
       FROM place_verification_events
       WHERE place_id = $1
         AND actor_user_id = $2
         AND source = $3
         AND event_type = 'CONFIRMED_ACTIVE'
         AND created_at >= NOW() - ($4::integer * INTERVAL '1 day')
       ORDER BY created_at DESC
       LIMIT 1`,
      [placeId, actorUserId, source, PLACE_ACTIVE_CONFIRMATION_COOLDOWN_DAYS]
    );
    if (recent.rows[0]) {
      throw new AppError(
        'Bạn đã xác nhận địa điểm này gần đây. HOLA chỉ ghi nhận một lần trong mỗi 30 ngày.',
        409,
        { nextAllowedAt: new Date(new Date(recent.rows[0].created_at).getTime() + PLACE_ACTIVE_CONFIRMATION_COOLDOWN_DAYS * 86400000).toISOString() }
      );
    }

    await client.query(
      `INSERT INTO place_verification_events (
         place_id, actor_user_id, source, event_type, note
       ) VALUES ($1, $2, $3, 'CONFIRMED_ACTIVE', $4)`,
      [
        placeId,
        actorUserId,
        source,
        source === 'OWNER'
          ? 'Chủ địa điểm xác nhận vẫn đang hoạt động'
          : 'Thành viên cộng đồng xác nhận địa điểm vẫn đang hoạt động'
      ]
    );

    return getPlaceTrustSummary(placeId, client);
  });
}
