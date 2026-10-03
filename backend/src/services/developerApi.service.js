import crypto from 'node:crypto';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const DEVELOPER_API_ENDPOINTS = [
  { key: 'meta', method: 'GET', path: '/meta', label: 'Thông tin API', sortOrder: 10 },
  { key: 'openapi', method: 'GET', path: '/openapi.json', label: 'OpenAPI schema', sortOrder: 20 },
  { key: 'categories', method: 'GET', path: '/categories', label: 'Danh mục', sortOrder: 30 },
  { key: 'places.list', method: 'GET', path: '/places', label: 'Danh sách & tìm kiếm địa điểm', sortOrder: 40 },
  { key: 'places.bounds', method: 'GET', path: '/places/bounds', label: 'Địa điểm theo vùng bản đồ', sortOrder: 50 },
  { key: 'places.geojson', method: 'GET', path: '/places/geojson', label: 'GeoJSON địa điểm', sortOrder: 60 },
  { key: 'places.nearby', method: 'GET', path: '/places/nearby', label: 'Địa điểm lân cận', sortOrder: 70 },
  { key: 'places.detail', method: 'GET', path: '/places/:id', label: 'Chi tiết địa điểm theo ID', sortOrder: 80 },
  { key: 'places.slug', method: 'GET', path: '/places/slug/:slug', label: 'Chi tiết địa điểm theo slug', sortOrder: 90 }
];

const SETTINGS_CACHE_MS = 5000;
const ENDPOINT_CACHE_MS = 5000;
const ORIGIN_CACHE_MS = 15000;
let settingsCache = null;
let endpointsCache = null;
let originsCache = null;

function nowMs() { return Date.now(); }
function cacheValid(entry, ttl) { return entry && nowMs() - entry.at < ttl; }

export function invalidateDeveloperApiCache() {
  settingsCache = null;
  endpointsCache = null;
  originsCache = null;
}

function baseUrl() {
  return String(env.publicBaseUrl || '').replace(/\/$/, '') + '/api/public/v1';
}

function docsUrl() {
  const web = String(env.holaMapsWebUrl || env.publicBaseUrl || '').trim().replace(/\/$/, '');
  return web ? web + '/developers' : '/developers';
}

function normalizeOrigins(origins = []) {
  const normalized = [];
  for (const value of origins || []) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    try {
      const origin = new URL(raw).origin;
      if (!normalized.includes(origin)) normalized.push(origin);
    } catch {
      // Input validation rejects malformed URLs.
    }
  }
  return normalized;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'api-client';
}

async function uniqueClientSlug(name) {
  const root = slugify(name);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : root + '-' + (i + 1);
    const { rowCount } = await pool.query(
      'SELECT 1 FROM developer_api_clients WHERE slug = $1',
      [candidate]
    );
    if (!rowCount) return candidate;
  }
  return root + '-' + Date.now();
}

function mapSettings(row) {
  return {
    enabled: row?.enabled !== false,
    accessMode: row?.access_mode || 'OPEN',
    docsEnabled: row?.docs_enabled !== false,
    updatedAt: row?.updated_at || null,
    baseUrl: baseUrl(),
    docsUrl: docsUrl(),
    apiKeyHeader: 'X-Hola-API-Key'
  };
}

export async function getDeveloperApiSettings() {
  if (cacheValid(settingsCache, SETTINGS_CACHE_MS)) return settingsCache.value;
  const { rows } = await pool.query(
    'SELECT enabled, access_mode, docs_enabled, updated_at FROM developer_api_settings WHERE id = 1'
  );
  const value = mapSettings(rows[0]);
  settingsCache = { at: nowMs(), value };
  return value;
}

export async function updateDeveloperApiSettings(data, userId) {
  const { rows } = await pool.query(
    [
      'UPDATE developer_api_settings',
      'SET enabled = COALESCE($1, enabled),',
      '    access_mode = COALESCE($2, access_mode),',
      '    docs_enabled = COALESCE($3, docs_enabled),',
      '    updated_by = $4,',
      '    updated_at = NOW()',
      'WHERE id = 1',
      'RETURNING enabled, access_mode, docs_enabled, updated_at'
    ].join('\n'),
    [data.enabled ?? null, data.accessMode ?? null, data.docsEnabled ?? null, userId]
  );
  invalidateDeveloperApiCache();
  return mapSettings(rows[0]);
}

function mapEndpoint(row) {
  return {
    key: row.endpoint_key,
    method: row.method,
    path: row.path_template,
    label: row.label,
    enabled: row.enabled,
    requiresKey: row.requires_key,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at
  };
}

export async function listDeveloperApiEndpoints() {
  if (cacheValid(endpointsCache, ENDPOINT_CACHE_MS)) return endpointsCache.value;
  const { rows } = await pool.query(
    'SELECT endpoint_key, method, path_template, label, enabled, requires_key, sort_order, updated_at FROM developer_api_endpoints ORDER BY sort_order, endpoint_key'
  );
  const value = rows.map(mapEndpoint);
  endpointsCache = { at: nowMs(), value };
  return value;
}

export async function updateDeveloperApiEndpoint(key, data, userId) {
  const { rows } = await pool.query(
    [
      'UPDATE developer_api_endpoints',
      'SET enabled = COALESCE($2, enabled),',
      '    requires_key = COALESCE($3, requires_key),',
      '    updated_by = $4,',
      '    updated_at = NOW()',
      'WHERE endpoint_key = $1',
      'RETURNING endpoint_key, method, path_template, label, enabled, requires_key, sort_order, updated_at'
    ].join('\n'),
    [key, data.enabled ?? null, data.requiresKey ?? null, userId]
  );
  if (!rows[0]) throw new AppError('Developer API endpoint not found.', 404);
  invalidateDeveloperApiCache();
  return mapEndpoint(rows[0]);
}

export async function getDeveloperApiGatewayConfig() {
  const [settings, endpoints] = await Promise.all([
    getDeveloperApiSettings(),
    listDeveloperApiEndpoints()
  ]);
  return { settings, endpoints: new Map(endpoints.map((item) => [item.key, item])) };
}

export async function getDeveloperApiAllowedOrigins() {
  if (cacheValid(originsCache, ORIGIN_CACHE_MS)) return originsCache.value;
  const { rows } = await pool.query(
    "SELECT allowed_origins FROM developer_api_clients WHERE status = 'ACTIVE'"
  );
  const value = Array.from(new Set(rows.flatMap((row) => row.allowed_origins || [])));
  originsCache = { at: nowMs(), value };
  return value;
}

function mapClient(row) {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    status: row.status,
    allowedOrigins: row.allowed_origins || [],
    permissions: row.permissions || ['*'],
    rateLimitPerMinute: Number(row.rate_limit_per_minute) || 300,
    note: row.note || '',
    keyCount: Number(row.key_count || 0),
    activeKeyCount: Number(row.active_key_count || 0),
    requests24h: Number(row.requests_24h || 0),
    lastRequestAt: row.last_request_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listDeveloperApiClients() {
  const { rows } = await pool.query(
    [
      'SELECT c.*,',
      '  (SELECT COUNT(*) FROM developer_api_keys k WHERE k.client_id = c.id) AS key_count,',
      "  (SELECT COUNT(*) FROM developer_api_keys k WHERE k.client_id = c.id AND k.status = 'ACTIVE') AS active_key_count,",
      "  (SELECT COUNT(*) FROM developer_api_usage_logs l WHERE l.client_id = c.id AND l.created_at >= NOW() - INTERVAL '24 hours') AS requests_24h,",
      '  (SELECT MAX(l.created_at) FROM developer_api_usage_logs l WHERE l.client_id = c.id) AS last_request_at',
      'FROM developer_api_clients c',
      'ORDER BY c.created_at DESC'
    ].join('\n')
  );
  return rows.map(mapClient);
}

export async function createDeveloperApiClient(data, userId) {
  const slug = await uniqueClientSlug(data.name);
  const origins = normalizeOrigins(data.allowedOrigins);
  const permissions = Array.isArray(data.permissions) && data.permissions.length ? data.permissions : ['*'];
  const { rows } = await pool.query(
    [
      'INSERT INTO developer_api_clients',
      '  (name, slug, status, allowed_origins, permissions, rate_limit_per_minute, note, created_by, updated_by)',
      "VALUES ($1,$2,'ACTIVE',$3,$4,$5,$6,$7,$7)",
      'RETURNING *'
    ].join('\n'),
    [data.name.trim(), slug, origins, permissions, data.rateLimitPerMinute || 300, data.note || null, userId]
  );
  invalidateDeveloperApiCache();
  return mapClient(rows[0]);
}

export async function updateDeveloperApiClient(id, data, userId) {
  const current = await pool.query('SELECT * FROM developer_api_clients WHERE id = $1', [id]);
  if (!current.rows[0]) throw new AppError('Developer API client not found.', 404);
  const row = current.rows[0];
  const origins = data.allowedOrigins === undefined ? row.allowed_origins : normalizeOrigins(data.allowedOrigins);
  const permissions = data.permissions === undefined ? row.permissions : (data.permissions.length ? data.permissions : ['*']);

  const { rows } = await pool.query(
    [
      'UPDATE developer_api_clients',
      'SET name = COALESCE($2, name),',
      '    status = COALESCE($3, status),',
      '    allowed_origins = $4,',
      '    permissions = $5,',
      '    rate_limit_per_minute = COALESCE($6, rate_limit_per_minute),',
      '    note = COALESCE($7, note),',
      '    updated_by = $8,',
      '    updated_at = NOW()',
      'WHERE id = $1',
      'RETURNING *'
    ].join('\n'),
    [id, data.name ?? null, data.status ?? null, origins, permissions, data.rateLimitPerMinute ?? null, data.note ?? null, userId]
  );
  invalidateDeveloperApiCache();
  return mapClient(rows[0]);
}

function mapKey(row) {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    clientName: row.client_name || null,
    name: row.name,
    prefix: row.key_prefix,
    last4: row.key_last4,
    status: row.status,
    lastUsedAt: row.last_used_at || null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at
  };
}

export async function listDeveloperApiKeys(clientId) {
  const params = [];
  let where = '';
  if (clientId) {
    params.push(clientId);
    where = 'WHERE k.client_id = $1';
  }
  const { rows } = await pool.query(
    [
      'SELECT k.*, c.name AS client_name',
      'FROM developer_api_keys k',
      'JOIN developer_api_clients c ON c.id = k.client_id',
      where,
      'ORDER BY k.created_at DESC'
    ].join('\n'),
    params
  );
  return rows.map(mapKey);
}

function hashApiKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export async function createDeveloperApiKey(data, userId) {
  const client = await pool.query(
    'SELECT id, name FROM developer_api_clients WHERE id = $1',
    [data.clientId]
  );
  if (!client.rows[0]) throw new AppError('Developer API client not found.', 404);

  const secret = 'hm_live_' + crypto.randomBytes(24).toString('base64url');
  const hash = hashApiKey(secret);
  const prefix = secret.slice(0, 15);
  const last4 = secret.slice(-4);
  const { rows } = await pool.query(
    [
      'INSERT INTO developer_api_keys',
      '  (client_id, name, key_hash, key_prefix, key_last4, status, expires_at, created_by)',
      "VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7)",
      'RETURNING *'
    ].join('\n'),
    [data.clientId, data.name || 'Primary key', hash, prefix, last4, data.expiresAt || null, userId]
  );

  return {
    ...mapKey({ ...rows[0], client_name: client.rows[0].name }),
    secret
  };
}

export async function revokeDeveloperApiKey(id) {
  const { rows } = await pool.query(
    "UPDATE developer_api_keys SET status = 'REVOKED', updated_at = NOW() WHERE id = $1 RETURNING *",
    [id]
  );
  if (!rows[0]) throw new AppError('Developer API key not found.', 404);
  return mapKey(rows[0]);
}

export async function resolveDeveloperApiKey(rawKey) {
  const value = String(rawKey || '').trim();
  if (!value || !value.startsWith('hm_live_')) return null;
  const hash = hashApiKey(value);
  const { rows } = await pool.query(
    [
      'SELECT k.id AS key_id, k.client_id, k.status AS key_status, k.expires_at,',
      '  c.name AS client_name, c.slug AS client_slug, c.status AS client_status,',
      '  c.allowed_origins, c.permissions, c.rate_limit_per_minute',
      'FROM developer_api_keys k',
      'JOIN developer_api_clients c ON c.id = k.client_id',
      'WHERE k.key_hash = $1',
      'LIMIT 1'
    ].join('\n'),
    [hash]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.key_status !== 'ACTIVE' || row.client_status !== 'ACTIVE') return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;

  return {
    keyId: String(row.key_id),
    clientId: String(row.client_id),
    clientName: row.client_name,
    clientSlug: row.client_slug,
    allowedOrigins: row.allowed_origins || [],
    permissions: row.permissions || ['*'],
    rateLimitPerMinute: Number(row.rate_limit_per_minute) || 300
  };
}

export async function touchDeveloperApiKey(keyId) {
  await pool.query(
    'UPDATE developer_api_keys SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1',
    [keyId]
  );
}

export async function recordDeveloperApiUsage(data) {
  await pool.query(
    [
      'INSERT INTO developer_api_usage_logs',
      '  (client_id, key_id, endpoint_key, method, path, status_code, duration_ms, origin, ip_address, user_agent)',
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)'
    ].join('\n'),
    [
      data.clientId || null, data.keyId || null, data.endpointKey || null,
      data.method, data.path, Number(data.statusCode) || 0,
      Math.max(0, Number(data.durationMs) || 0), data.origin || null,
      data.ipAddress || null, data.userAgent || null
    ]
  );
}

export async function listDeveloperApiUsageLogs({ clientId, endpointKey, statusCode, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  if (clientId) { params.push(clientId); conditions.push('l.client_id = $' + params.length); }
  if (endpointKey) { params.push(endpointKey); conditions.push('l.endpoint_key = $' + params.length); }
  if (statusCode) { params.push(Number(statusCode)); conditions.push('l.status_code = $' + params.length); }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 300));
  const limitRef = '$' + params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetRef = '$' + params.length;
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await pool.query(
    [
      'SELECT l.*, c.name AS client_name, k.name AS key_name',
      'FROM developer_api_usage_logs l',
      'LEFT JOIN developer_api_clients c ON c.id = l.client_id',
      'LEFT JOIN developer_api_keys k ON k.id = l.key_id',
      where,
      'ORDER BY l.created_at DESC',
      'LIMIT ' + limitRef + ' OFFSET ' + offsetRef
    ].join('\n'),
    params
  );

  return rows.map((row) => ({
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: row.client_name || 'Open access',
    keyName: row.key_name || null,
    endpointKey: row.endpoint_key,
    method: row.method,
    path: row.path,
    statusCode: Number(row.status_code),
    durationMs: Number(row.duration_ms),
    origin: row.origin,
    ipAddress: row.ip_address,
    createdAt: row.created_at
  }));
}

export async function getDeveloperApiOverview() {
  const settings = await getDeveloperApiSettings();
  const [clientResult, keyResult, usageResult] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM developer_api_clients"),
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM developer_api_keys"),
    pool.query([
      'SELECT',
      "  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS requests_24h,",
      "  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status_code >= 400)::int AS errors_24h,",
      "  COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')),0)::int AS avg_duration_24h,",
      '  MAX(created_at) AS last_request_at',
      'FROM developer_api_usage_logs'
    ].join('\n'))
  ]);
  return {
    settings,
    clients: clientResult.rows[0] || { total: 0, active: 0 },
    keys: keyResult.rows[0] || { total: 0, active: 0 },
    usage: usageResult.rows[0] || { requests_24h: 0, errors_24h: 0, avg_duration_24h: 0, last_request_at: null }
  };
}

export function matchDeveloperApiEndpoint(pathname, method = 'GET') {
  if (String(method).toUpperCase() !== 'GET') return null;
  const path = String(pathname || '').split('?')[0];
  if (path === '/meta') return 'meta';
  if (path === '/openapi.json') return 'openapi';
  if (path === '/categories') return 'categories';
  if (path === '/places/bounds') return 'places.bounds';
  if (path === '/places/geojson') return 'places.geojson';
  if (path === '/places/nearby') return 'places.nearby';
  if (/^\/places\/slug\/[^/]+$/.test(path)) return 'places.slug';
  if (/^\/places\/\d+$/.test(path)) return 'places.detail';
  if (path === '/places') return 'places.list';
  return null;
}

export function getDeveloperApiOpenApiDocument() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Hola Maps Developer API',
      version: '1.0.0',
      description: 'Public read-only API for Hola Maps places, search and map integrations.'
    },
    servers: [{ url: baseUrl() }],
    components: {
      securitySchemes: {
        HolaApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Hola-API-Key',
          description: 'Partner key. Browser keys are visible to end users; use allowed-origin restrictions and quota.'
        }
      }
    },
    paths: {
      '/meta': { get: { summary: 'API metadata', responses: { 200: { description: 'OK' } } } },
      '/categories': { get: { summary: 'Public categories', responses: { 200: { description: 'OK' } } } },
      '/places': { get: { summary: 'List or search places', responses: { 200: { description: 'OK' } } } },
      '/places/bounds': { get: { summary: 'Places inside map bounds', responses: { 200: { description: 'OK' } } } },
      '/places/geojson': { get: { summary: 'GeoJSON places inside map bounds', responses: { 200: { description: 'GeoJSON FeatureCollection' } } } },
      '/places/nearby': { get: { summary: 'Nearby places', responses: { 200: { description: 'OK' } } } },
      '/places/{id}': { get: { summary: 'Place detail by ID', responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } } },
      '/places/slug/{slug}': { get: { summary: 'Place detail by slug', responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } } },
      '/openapi.json': { get: { summary: 'OpenAPI schema', responses: { 200: { description: 'OpenAPI document' } } } }
    }
  };
}
