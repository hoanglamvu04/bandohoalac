import { pool, withTransaction } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';
import { AppError } from '../utils/AppError.js';

export const ROAD_STATUS_TYPES = [
  'REPORT_FLOOD',
  'REPORT_ROAD_CLOSURE',
  'REPORT_ALERT'
];

const TYPE_TO_LAYER = {
  REPORT_FLOOD: 'FLOOD',
  REPORT_ROAD_CLOSURE: 'ROAD_CLOSURE',
  REPORT_ALERT: 'ALERT'
};

const TYPE_TO_NAME = {
  REPORT_FLOOD: 'Báo ngập',
  REPORT_ROAD_CLOSURE: 'Báo đường cấm',
  REPORT_ALERT: 'Cảnh báo giao thông'
};

export function isRoadStatusContributionType(type) {
  return ROAD_STATUS_TYPES.includes(String(type || ''));
}

export function roadStatusLayerType(type) {
  return TYPE_TO_LAYER[type] || 'ALERT';
}

export function roadStatusDisplayName(type) {
  return TYPE_TO_NAME[type] || 'Cảnh báo cộng đồng';
}

export function defaultRoadStatusExpiryHours(type, severity = 'MEDIUM') {
  if (type === 'REPORT_FLOOD') {
    return severity === 'CRITICAL' || severity === 'HIGH' ? 12 : 6;
  }
  if (type === 'REPORT_ROAD_CLOSURE') {
    return severity === 'CRITICAL' || severity === 'HIGH' ? 24 : 12;
  }
  return severity === 'CRITICAL' || severity === 'HIGH' ? 8 : 4;
}

function reportTypesForLayers(types = []) {
  const normalized = new Set((types || []).map((item) => String(item).trim().toUpperCase()));
  if (!normalized.size) return ROAD_STATUS_TYPES;

  return ROAD_STATUS_TYPES.filter((type) => normalized.has(TYPE_TO_LAYER[type]));
}

function asFeature(row) {
  const payload = row.payload || {};
  const active = Number(row.active_confirmations || 0);
  const resolved = Number(row.resolved_confirmations || 0);
  const trust = Number(row.trust_score || 0);
  const confidenceScore = Math.max(
    0,
    Math.min(100, 35 + Math.min(30, trust) + active * 12 - resolved * 16)
  );

  return {
    type: 'Feature',
    id: 'community-status-' + row.id,
    geometry: row.geometry,
    properties: {
      id: 'community-status-' + row.id,
      reportId: row.id,
      contributionId: row.id,
      layerType: roadStatusLayerType(row.type),
      incidentType: row.type,
      name: roadStatusDisplayName(row.type),
      description: payload.reason || '',
      severity: payload.severity || 'MEDIUM',
      status: 'ACTIVE',
      sourceType: 'COMMUNITY',
      sourceLabel: 'Cộng đồng báo cáo',
      verificationStatus: 'PENDING',
      activeConfirmations: active,
      resolvedConfirmations: resolved,
      confidenceScore,
      reportedAt: row.created_at,
      validUntil: payload.expiresAt || null,
      photo: Array.isArray(payload.photos) ? payload.photos[0] || null : null,
      photoCount: Array.isArray(payload.photos) ? payload.photos.length : 0
    }
  };
}

export async function listCommunityRoadStatusFeatures({
  types = [],
  west,
  south,
  east,
  north
} = {}) {
  const reportTypes = reportTypesForLayers(types);
  if (!reportTypes.length) return [];

  const params = [reportTypes, SERVICE_AREA_GEOJSON_STRING];
  const where = [
    'ct.type = ANY($1::text[])',
    "ct.status = 'PENDING'",
    "COALESCE(ct.payload->>'communityState', 'ACTIVE') = 'ACTIVE'",
    "ct.payload ? 'location'",
    "(ct.payload->>'expiresAt' IS NULL OR (ct.payload->>'expiresAt')::timestamptz > NOW())",
    'ST_CoveredBy(status_point.geom, service_area.geom)'
  ];

  if ([west, south, east, north].every(Number.isFinite)) {
    params.push(west, south, east, north);
    const start = params.length - 3;
    where.push(
      'status_point.geom && ST_MakeEnvelope($' + start + ', $' + (start + 1) + ', $' +
      (start + 2) + ', $' + (start + 3) + ', 4326)'
    );
  }

  const sql = [
    'WITH service_area AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) AS geom',
    ')',
    'SELECT',
    '  ct.id, ct.type, ct.payload, ct.created_at, u.trust_score,',
    "  ST_AsGeoJSON(status_point.geom)::json AS geometry,",
    "  COUNT(rc.id) FILTER (WHERE rc.verdict = 'STILL_ACTIVE')::int AS active_confirmations,",
    "  COUNT(rc.id) FILTER (WHERE rc.verdict = 'RESOLVED')::int AS resolved_confirmations",
    'FROM contributions ct',
    'JOIN users u ON u.id = ct.user_id',
    'CROSS JOIN LATERAL (',
    '  SELECT ST_SetSRID(ST_MakePoint(',
    "    (ct.payload #>> '{location,lng}')::double precision,",
    "    (ct.payload #>> '{location,lat}')::double precision",
    '  ), 4326) AS geom',
    ') status_point',
    'CROSS JOIN service_area',
    'LEFT JOIN road_status_confirmations rc ON rc.contribution_id = ct.id',
    'WHERE ' + where.join(' AND '),
    'GROUP BY ct.id, ct.type, ct.payload, ct.created_at, u.trust_score, status_point.geom',
    'ORDER BY ct.created_at DESC',
    'LIMIT 500'
  ].join('\n');

  const { rows } = await pool.query(sql, params);
  return rows.filter((row) => row.geometry).map(asFeature);
}

export async function confirmRoadStatus({ contributionId, userId, verdict }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id, type, status, payload
       FROM contributions
       WHERE id = $1
       FOR UPDATE`,
      [contributionId]
    );

    const report = rows[0];
    if (!report || !isRoadStatusContributionType(report.type)) {
      throw new AppError('Road status report not found.', 404);
    }
    if (!['PENDING', 'APPROVED'].includes(report.status)) {
      throw new AppError('This report is no longer active.', 409);
    }
    if (Number(report.user_id) === Number(userId)) {
      throw new AppError('Bạn không thể tự xác nhận báo cáo của mình.', 400);
    }

    const expiresAt = report.payload?.expiresAt
      ? new Date(report.payload.expiresAt).getTime()
      : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      throw new AppError('Báo cáo này đã hết hạn.', 409);
    }

    await client.query(
      `INSERT INTO road_status_confirmations (
         contribution_id, user_id, verdict, created_at, updated_at
       ) VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (contribution_id, user_id)
       DO UPDATE SET verdict = EXCLUDED.verdict, updated_at = NOW()`,
      [contributionId, userId, verdict]
    );

    const countsResult = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE verdict = 'STILL_ACTIVE')::int AS active,
         COUNT(*) FILTER (WHERE verdict = 'RESOLVED')::int AS resolved
       FROM road_status_confirmations
       WHERE contribution_id = $1`,
      [contributionId]
    );

    const active = Number(countsResult.rows[0]?.active || 0);
    const resolved = Number(countsResult.rows[0]?.resolved || 0);
    const shouldResolve = resolved >= 2 && resolved >= active + 2;

    if (shouldResolve) {
      await client.query(
        `UPDATE contributions
         SET payload = jsonb_set(payload, '{communityState}', '"RESOLVED"'::jsonb, true),
             updated_at = NOW()
         WHERE id = $1`,
        [contributionId]
      );

      await client.query(
        `UPDATE map_features
         SET status = 'ARCHIVED', updated_at = NOW()
         WHERE properties->>'contributionId' = $1`,
        [String(contributionId)]
      );
    }

    return {
      reportId: contributionId,
      verdict,
      activeConfirmations: active,
      resolvedConfirmations: resolved,
      communityState: shouldResolve ? 'RESOLVED' : 'ACTIVE'
    };
  });
}
