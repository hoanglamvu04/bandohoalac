import { randomBytes } from 'node:crypto';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const EMBED_PATH = /^\/embed(?:\/|$)/;
const EMBED_KEY_PATTERN = /^he_[A-Za-z0-9_-]{32}$/;

function normalizedOrigins(input) {
  const result = [];
  for (const raw of input || []) {
    let url;
    try { url = new URL(String(raw)); } catch {
      throw new AppError('Domain nhúng không hợp lệ.', 400);
    }
    const localHttp = env.nodeEnv !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      !(url.protocol === 'https:' || localHttp) ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.hostname.includes('*')
    ) {
      throw new AppError('Chỉ chấp nhận domain HTTPS cụ thể; không dùng wildcard, path hoặc query.', 400);
    }
    if (!result.includes(url.origin)) result.push(url.origin);
  }
  if (!result.length || result.length > 10) {
    throw new AppError('Mỗi ứng dụng phải có từ 1 tới 10 domain.', 400);
  }
  return result;
}

function issueKey() {
  // This is a PUBLIC, revocable iframe identifier, NOT a server-side API secret.
  return 'he_' + randomBytes(24).toString('base64url');
}

function embedBaseUrl() {
  return String(env.holaMapsWebUrl || env.publicBaseUrl || '')
    .replace(/\/$/, '');
}

function mapApplication(row) {
  if (!row) return null;
  const key = row.status === 'APPROVED' ? row.embed_key : null;
  return {
    id: String(row.id),
    appName: row.app_name,
    contactEmail: row.contact_email,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    requestedOrigins: row.requested_origins || [],
    approvedOrigins: row.approved_origins || [],
    status: row.status,
    embedKey: key,
    embedUrl: key ? embedBaseUrl() + '/embed?key=' + encodeURIComponent(key) : null,
    note: row.note || null,
    reviewNote: row.review_note || null,
    approvedAt: row.reviewed_at || null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function requestEmbed({ userId, appName, contactEmail, origins, note }) {
  const trustedOrigins = normalizedOrigins(origins);
  const { rows } = await pool.query(
    [
      'INSERT INTO embed_applications',
      '(app_name, contact_email, requested_by, requested_origins, note)',
      'VALUES ($1, $2, $3, $4::text[], $5) RETURNING *'
    ].join(' '),
    [appName, contactEmail, userId, trustedOrigins, note || null]
  );
  return mapApplication(rows[0]);
}

export async function listOwnEmbeds(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM embed_applications WHERE requested_by = $1 ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return rows.map(mapApplication);
}

export async function listEmbedsAdmin() {
  const { rows } = await pool.query(
    'SELECT * FROM embed_applications ORDER BY created_at DESC LIMIT 300'
  );
  return rows.map(mapApplication);
}

export async function createApprovedEmbed({ appName, contactEmail, origins, note, validDays, reviewedBy }) {
  const approvedOrigins = normalizedOrigins(origins);
  const embedKey = issueKey();
  const { rows } = await pool.query(
    [
      'INSERT INTO embed_applications',
      '(app_name, contact_email, requested_origins, approved_origins,',
      'note, status, embed_key, expires_at, reviewed_by, reviewed_at)',
      "VALUES ($1, $2, $3::text[], $3::text[], $4, 'APPROVED', $5,",
      "NOW() + $6::integer * INTERVAL '1 day', $7, NOW()) RETURNING *"
    ].join(' '),
    [appName, contactEmail, approvedOrigins, note || null, embedKey, validDays, reviewedBy]
  );
  return mapApplication(rows[0]);
}

export async function approveEmbed({ id, approvedOrigins, validDays, reviewedBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      'SELECT * FROM embed_applications WHERE id = $1 FOR UPDATE',
      [id]
    );
    const application = locked.rows[0];
    if (!application) throw new AppError('Không tìm thấy yêu cầu.', 404);
    if (application.status !== 'PENDING') {
      throw new AppError('Chỉ có thể duyệt yêu cầu đang chờ.', 409);
    }
    const approved = normalizedOrigins(approvedOrigins || application.requested_origins);
    if (!approved.every((origin) => application.requested_origins.includes(origin))) {
      throw new AppError('Domain duyệt phải nằm trong danh sách đã yêu cầu.', 400);
    }
    const { rows } = await client.query(
      [
        'UPDATE embed_applications SET status = $2,',
        'approved_origins = $3::text[], embed_key = $4,',
        "expires_at = NOW() + $5::integer * INTERVAL '1 day',",
        'reviewed_by = $6, reviewed_at = NOW(), updated_at = NOW()',
        'WHERE id = $1 RETURNING *'
      ].join(' '),
      [id, 'APPROVED', approved, issueKey(), validDays, reviewedBy]
    );
    await client.query('COMMIT');
    return mapApplication(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectEmbed({ id, reason, reviewedBy }) {
  const { rows } = await pool.query(
    [
      "UPDATE embed_applications SET status = 'REJECTED',",
      'review_note = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()',
      "WHERE id = $1 AND status = 'PENDING' RETURNING *"
    ].join(' '),
    [id, reason, reviewedBy]
  );
  if (!rows[0]) throw new AppError('Không tìm thấy yêu cầu đang chờ.', 404);
  return mapApplication(rows[0]);
}

export async function revokeEmbed(id, reviewedBy) {
  const { rows } = await pool.query(
    [
      "UPDATE embed_applications SET status = 'REVOKED',",
      'reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()',
      "WHERE id = $1 AND status = 'APPROVED' RETURNING *"
    ].join(' '),
    [id, reviewedBy]
  );
  if (!rows[0]) throw new AppError('Không tìm thấy mã nhúng đang hoạt động.', 404);
  return mapApplication(rows[0]);
}

export async function rotateEmbed({ id, validDays, reviewedBy }) {
  const { rows } = await pool.query(
    [
      'UPDATE embed_applications SET embed_key = $2,',
      "expires_at = NOW() + $3::integer * INTERVAL '1 day',",
      'reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()',
      "WHERE id = $1 AND status = 'APPROVED' RETURNING *"
    ].join(' '),
    [id, issueKey(), validDays, reviewedBy]
  );
  if (!rows[0]) throw new AppError('Không tìm thấy mã nhúng đang hoạt động.', 404);
  return mapApplication(rows[0]);
}

export async function policyForEmbedUri(originalUri) {
  let url;
  try { url = new URL(String(originalUri || ''), 'https://maps.invalid'); }
  catch { throw new AppError('Không thể xác thực URL nhúng.', 403); }

  const key = url.searchParams.get('key') || '';
  if (!EMBED_PATH.test(url.pathname) || !EMBED_KEY_PATTERN.test(key)) {
    throw new AppError('Cần mã nhúng hợp lệ để hiển thị bản đồ.', 403);
  }

  const { rows } = await pool.query(
    [
      'SELECT approved_origins FROM embed_applications',
      "WHERE embed_key = $1 AND status = 'APPROVED'",
      'AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1'
    ].join(' '),
    [key]
  );
  if (!rows[0]) throw new AppError('Mã nhúng hết hạn hoặc đã bị thu hồi.', 403);

  // Verify DB values again before inserting them into HTTP header directives.
  return normalizedOrigins(rows[0].approved_origins);
}
