import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALGORITHM = 'aes-256-gcm';
const FOURSQUARE_API = 'https://places-api.foursquare.com';
const FOURSQUARE_VERSION = '2025-06-17';

const PROVIDERS = Object.freeze({
  FOURSQUARE: {
    key: 'FOURSQUARE',
    label: 'Foursquare Places',
    description: 'Bổ sung ảnh storefront, exterior và ảnh địa điểm cho Photo Scanner.',
    envFallback: () => env.foursquareApiKey || ''
  }
});

function encryptionKey() {
  return createHash('sha256')
    .update('hola-maps:integration-secrets:v1:')
    .update(String(env.jwtSecret || ''))
    .digest();
}

function aadFor(provider) {
  return Buffer.from('hola-maps:integration:' + normalizeProvider(provider), 'utf8');
}

export function normalizeIntegrationProvider(provider) {
  return String(provider || '').trim().toUpperCase();
}

function normalizeProvider(provider) {
  const key = normalizeIntegrationProvider(provider);
  if (!PROVIDERS[key]) {
    throw new AppError('Nguồn tích hợp không được hỗ trợ.', 400);
  }
  return key;
}

export function maskIntegrationSecret(secret) {
  const value = String(secret || '');
  if (!value) return null;
  const tail = value.slice(-4);
  return '••••••••' + tail;
}

export function encryptIntegrationSecret(secret, provider = 'FOURSQUARE') {
  const key = normalizeProvider(provider);
  const value = String(secret || '').trim();
  if (!value) throw new AppError('API key không được để trống.', 400);

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(aadFor(key));
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

export function decryptIntegrationSecret(payload, provider = 'FOURSQUARE') {
  const key = normalizeProvider(provider);
  if (!payload) return null;
  const ciphertext = payload.ciphertext ?? payload.cipher_text;
  const iv = payload.iv;
  const authTag = payload.authTag ?? payload.auth_tag;
  if (!ciphertext || !iv || !authTag) return null;

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(iv, 'base64')
  );
  decipher.setAAD(aadFor(key));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

function publicProvider(provider, row, fallbackSecret = '') {
  const config = PROVIDERS[provider];
  const hasDbSecret = Boolean(row?.ciphertext && row?.status === 'ACTIVE');
  const hasFallback = Boolean(fallbackSecret);
  const configured = hasDbSecret || hasFallback;
  const source = hasDbSecret ? 'ADMIN_DB' : (hasFallback ? 'ENV_LEGACY' : null);
  const masked = hasDbSecret
    ? (row.last4 ? '••••••••' + row.last4 : '••••••••')
    : maskIntegrationSecret(fallbackSecret);

  return {
    provider,
    label: config.label,
    description: config.description,
    configured,
    source,
    masked,
    status: hasDbSecret ? row.status : (hasFallback ? 'ACTIVE' : 'NOT_CONFIGURED'),
    lastTestStatus: row?.last_test_status || null,
    lastTestMessage: row?.last_test_message || null,
    lastTestedAt: row?.last_tested_at || null,
    updatedAt: row?.updated_at || null
  };
}

async function getDbSecretRow(provider, client = pool) {
  const key = normalizeProvider(provider);
  const { rows } = await client.query(
    `SELECT provider, ciphertext, iv, auth_tag, last4, status,
            last_test_status, last_test_message, last_tested_at,
            created_by, updated_by, created_at, updated_at
     FROM integration_secrets
     WHERE provider = $1
     LIMIT 1`,
    [key]
  );
  return rows[0] || null;
}

export async function resolveIntegrationSecret(provider, { allowEnvFallback = true } = {}) {
  const key = normalizeProvider(provider);
  const row = await getDbSecretRow(key);

  if (row?.status === 'ACTIVE') {
    try {
      const secret = decryptIntegrationSecret(row, key);
      if (secret) return { secret, source: 'ADMIN_DB', provider: key };
    } catch (error) {
      console.error('[Hola Maps] failed to decrypt integration secret for', key, error?.message || error);
    }
  }

  if (allowEnvFallback) {
    const fallback = String(PROVIDERS[key].envFallback?.() || '').trim();
    if (fallback) return { secret: fallback, source: 'ENV_LEGACY', provider: key };
  }

  return { secret: null, source: null, provider: key };
}

export async function listIntegrationProviders() {
  const { rows } = await pool.query(
    `SELECT provider, ciphertext, last4, status,
            last_test_status, last_test_message, last_tested_at, updated_at
     FROM integration_secrets`
  );
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return Object.keys(PROVIDERS).map((provider) => publicProvider(
    provider,
    byProvider.get(provider),
    String(PROVIDERS[provider].envFallback?.() || '').trim()
  ));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.photoScanRequestTimeoutMs || 9000);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    return { response, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

async function testFoursquare(secret) {
  const url = new URL(FOURSQUARE_API + '/places/search');
  url.searchParams.set('query', 'cafe');
  url.searchParams.set('ll', '21.0000,105.5000');
  url.searchParams.set('radius', '1000');
  url.searchParams.set('limit', '1');

  try {
    const { response, latencyMs } = await fetchWithTimeout(url, {
      headers: {
        Authorization: 'Bearer ' + secret,
        'X-Places-Api-Version': FOURSQUARE_VERSION
      }
    });

    if (response.ok) {
      return {
        ok: true,
        statusCode: response.status,
        latencyMs,
        message: 'Kết nối Foursquare thành công.'
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        statusCode: response.status,
        latencyMs,
        message: 'API key Foursquare không hợp lệ hoặc không có quyền truy cập.'
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      latencyMs,
      message: 'Foursquare trả về HTTP ' + response.status + '.'
    };
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return {
      ok: false,
      statusCode: null,
      latencyMs: null,
      message: timedOut
        ? 'Kết nối Foursquare bị quá thời gian chờ.'
        : 'Không kết nối được Foursquare.'
    };
  }
}

export async function testIntegrationSecret(provider, { secret } = {}) {
  const key = normalizeProvider(provider);
  let value = String(secret || '').trim();
  let source = value ? 'DRAFT' : null;

  if (!value) {
    const resolved = await resolveIntegrationSecret(key);
    value = resolved.secret || '';
    source = resolved.source;
  }

  if (!value) {
    return {
      ok: false,
      provider: key,
      source: null,
      statusCode: null,
      latencyMs: null,
      message: 'Chưa có API key để kiểm tra.'
    };
  }

  let result;
  if (key === 'FOURSQUARE') {
    result = await testFoursquare(value);
  } else {
    result = { ok: false, message: 'Nguồn tích hợp chưa có trình kiểm tra.' };
  }

  if (source === 'ADMIN_DB') {
    await pool.query(
      `UPDATE integration_secrets
       SET last_test_status = $2,
           last_test_message = $3,
           last_tested_at = NOW(),
           updated_at = NOW()
       WHERE provider = $1`,
      [key, result.ok ? 'SUCCESS' : 'FAILED', result.message]
    );
  }

  return {
    provider: key,
    source,
    ...result
  };
}

export async function saveIntegrationSecret(provider, secret, userId) {
  const key = normalizeProvider(provider);
  const value = String(secret || '').trim();
  if (value.length < 8) {
    throw new AppError('API key quá ngắn hoặc không hợp lệ.', 400);
  }

  const test = await testIntegrationSecret(key, { secret: value });
  if (!test.ok) {
    throw new AppError(test.message || 'Không xác minh được API key.', 400, {
      provider: key,
      test: {
        ok: false,
        statusCode: test.statusCode || null,
        latencyMs: test.latencyMs || null
      }
    });
  }

  const encrypted = encryptIntegrationSecret(value, key);
  const last4 = value.slice(-4);
  const { rows } = await pool.query(
    `INSERT INTO integration_secrets (
       provider, ciphertext, iv, auth_tag, last4, status,
       last_test_status, last_test_message, last_tested_at,
       created_by, updated_by
     ) VALUES (
       $1,$2,$3,$4,$5,'ACTIVE','SUCCESS',$6,NOW(),$7,$7
     )
     ON CONFLICT (provider) DO UPDATE
     SET ciphertext = EXCLUDED.ciphertext,
         iv = EXCLUDED.iv,
         auth_tag = EXCLUDED.auth_tag,
         last4 = EXCLUDED.last4,
         status = 'ACTIVE',
         last_test_status = 'SUCCESS',
         last_test_message = EXCLUDED.last_test_message,
         last_tested_at = NOW(),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
     RETURNING provider, ciphertext, last4, status,
               last_test_status, last_test_message, last_tested_at, updated_at`,
    [
      key,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      last4,
      test.message,
      userId || null
    ]
  );

  return publicProvider(key, rows[0], '');
}

export async function deleteIntegrationSecret(provider) {
  const key = normalizeProvider(provider);
  await pool.query('DELETE FROM integration_secrets WHERE provider = $1', [key]);
  const fallback = String(PROVIDERS[key].envFallback?.() || '').trim();
  return publicProvider(key, null, fallback);
}
