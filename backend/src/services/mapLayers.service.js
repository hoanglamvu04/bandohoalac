import { pool } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_LAYERS = new Set([
  'ROAD', 'TERRAIN', 'WATER', 'BUILDING', 'LANDMARK',
  'FLOOD', 'ROAD_CLOSURE', 'ALERT', 'PLANNING', 'EVENT'
]);

function normalizeTypes(types = []) {
  return types
    .map((value) => String(value).trim().toUpperCase())
    .filter((value) => ALLOWED_LAYERS.has(value));
}

function rowToFeature(row) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: row.geometry,
    properties: {
      id: row.id,
      layerType: row.layer_type,
      name: row.name,
      severity: row.severity,
      status: row.status,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      ...(row.properties || {})
    }
  };
}

async function assertGeometryInsideCoverage(geometry) {
  if (!geometry) return;

  const sql = [
    'WITH input_geometry AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom',
    '), service_area AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) AS geom',
    ')',
    'SELECT ST_CoveredBy(input_geometry.geom, service_area.geom) AS inside',
    'FROM input_geometry, service_area'
  ].join('\n');

  const { rows } = await pool.query(sql, [
    JSON.stringify(geometry),
    SERVICE_AREA_GEOJSON_STRING
  ]);

  if (!rows[0]?.inside) {
    throw new AppError('Map feature must stay inside the Hola Maps service area.', 400);
  }
}

export async function listMapFeatures({ types = [], west, south, east, north } = {}) {
  const normalized = normalizeTypes(types);
  const params = [SERVICE_AREA_GEOJSON_STRING];
  const where = [
    "mf.status = 'ACTIVE'",
    '(mf.valid_from IS NULL OR mf.valid_from <= NOW())',
    '(mf.valid_until IS NULL OR mf.valid_until >= NOW())',
    'ST_Intersects(mf.geometry, service_area.geom)'
  ];

  if (normalized.length) {
    params.push(normalized);
    where.push('mf.layer_type = ANY($' + params.length + '::text[])');
  }

  if ([west, south, east, north].every(Number.isFinite)) {
    params.push(west, south, east, north);
    const start = params.length - 3;
    where.push(
      'mf.geometry && ST_MakeEnvelope($' + start + ', $' + (start + 1) + ', $' +
      (start + 2) + ', $' + (start + 3) + ', 4326)'
    );
  }

  const sql = [
    'WITH service_area AS (',
    '  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom',
    ')',
    'SELECT',
    '  mf.id, mf.layer_type, mf.name, mf.properties, mf.severity, mf.status,',
    '  mf.valid_from, mf.valid_until,',
    '  ST_AsGeoJSON(ST_Intersection(mf.geometry, service_area.geom))::json AS geometry',
    'FROM map_features mf',
    'CROSS JOIN service_area',
    'WHERE ' + where.join(' AND '),
    'ORDER BY mf.layer_type, mf.updated_at DESC',
    'LIMIT 1200'
  ].join('\n');

  const { rows } = await pool.query(sql, params);

  return {
    type: 'FeatureCollection',
    features: rows.filter((row) => row.geometry).map(rowToFeature)
  };
}

export async function createMapFeature(data, userId) {
  await assertGeometryInsideCoverage(data.geometry);

  const sql = [
    'INSERT INTO map_features (',
    '  layer_type, name, geometry, properties, severity, status,',
    '  valid_from, valid_until, created_by, updated_by',
    ') VALUES (',
    '  $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4::jsonb, $5, $6,',
    '  $7, $8, $9, $9',
    ') RETURNING id'
  ].join('\n');

  const { rows } = await pool.query(sql, [
    data.layerType,
    data.name || null,
    JSON.stringify(data.geometry),
    JSON.stringify(data.properties || {}),
    data.severity || null,
    data.status || 'ACTIVE',
    data.validFrom || null,
    data.validUntil || null,
    userId
  ]);
  return rows[0].id;
}

export async function updateMapFeature(id, data, userId) {
  if (data.geometry) await assertGeometryInsideCoverage(data.geometry);

  const sql = [
    'UPDATE map_features',
    'SET layer_type = COALESCE($2, layer_type),',
    '    name = COALESCE($3, name),',
    '    geometry = CASE',
    '      WHEN $4::text IS NULL THEN geometry',
    '      ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)',
    '    END,',
    '    properties = COALESCE($5::jsonb, properties),',
    '    severity = COALESCE($6, severity),',
    '    status = COALESCE($7, status),',
    '    valid_from = COALESCE($8, valid_from),',
    '    valid_until = COALESCE($9, valid_until),',
    '    updated_by = $10,',
    '    updated_at = NOW()',
    'WHERE id = $1'
  ].join('\n');

  const { rowCount } = await pool.query(sql, [
    id,
    data.layerType || null,
    data.name ?? null,
    data.geometry ? JSON.stringify(data.geometry) : null,
    data.properties ? JSON.stringify(data.properties) : null,
    data.severity || null,
    data.status || null,
    data.validFrom || null,
    data.validUntil || null,
    userId
  ]);
  return rowCount > 0;
}

export async function archiveMapFeature(id, userId) {
  const { rowCount } = await pool.query(
    "UPDATE map_features SET status = 'ARCHIVED', updated_by = $2, updated_at = NOW() WHERE id = $1",
    [id, userId]
  );
  return rowCount > 0;
}
