import {
  createHash,
  randomBytes,
  randomUUID
} from 'node:crypto';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { hashSensitiveValue } from './securityCrypto.service.js';

const REFRESH_COOKIE = 'hola_refresh';

function hashRefreshToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function normalizeUserAgent(value) {
  return String(value || '').slice(0, 500) || null;
}

function clientIpHash(ip) {
  if (!ip) return null;
  return hashSensitiveValue(ip, 'ip');
}

function refreshExpiry() {
  return new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);
}

function publicSession(row, currentSessionId = null) {
  return {
    id: String(row.id),
    current: currentSessionId ? String(row.id) === String(currentSessionId) : false,
    userAgent: row.user_agent || 'Thiết bị không xác định',
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    twoFactorVerified: Boolean(row.two_factor_verified_at)
  };
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE;
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth'
  });
}

export function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

export async function recordSecurityEvent({
  userId = null,
  sessionId = null,
  type,
  severity = 'INFO',
  ip = null,
  userAgent = null,
  metadata = {}
}) {
  try {
    await pool.query(
      `INSERT INTO security_events (
         user_id, session_id, event_type, severity, ip_hash, user_agent, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId || null,
        sessionId || null,
        type,
        severity,
        clientIpHash(ip),
        normalizeUserAgent(userAgent),
        JSON.stringify(metadata || {})
      ]
    );
  } catch (error) {
    console.warn('[Hola Maps] security event log failed:', error.message);
  }
}

export async function createRefreshSession({
  userId,
  userAgent,
  ip,
  twoFactorVerified = false
}) {
  const id = randomUUID();
  const refreshToken = randomBytes(48).toString('base64url');
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = refreshExpiry();

  await pool.query(
    `INSERT INTO auth_sessions (
       id, user_id, refresh_token_hash, user_agent, ip_hash,
       two_factor_verified_at, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      userId,
      refreshTokenHash,
      normalizeUserAgent(userAgent),
      clientIpHash(ip),
      twoFactorVerified ? new Date() : null,
      expiresAt
    ]
  );

  await recordSecurityEvent({
    userId,
    sessionId: id,
    type: 'SESSION_CREATED',
    ip,
    userAgent,
    metadata: { twoFactorVerified }
  });

  return { id, refreshToken, expiresAt };
}

export async function rotateRefreshSession(refreshToken, {
  userAgent,
  ip
} = {}) {
  const tokenHash = hashRefreshToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT s.*, u.email, u.role, u.account_status
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );
    const session = rows[0];

    if (!session) {
      const replay = await client.query(
        `SELECT h.session_id, h.user_id
         FROM auth_refresh_token_history h
         WHERE h.token_hash = $1
           AND h.expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
      );
      const reused = replay.rows[0];

      if (reused) {
        await client.query(
          `UPDATE auth_sessions
           SET revoked_at = COALESCE(revoked_at, NOW()),
               revoke_reason = COALESCE(revoke_reason, 'REFRESH_REUSE')
           WHERE user_id = $1
             AND revoked_at IS NULL`,
          [reused.user_id]
        );
        await client.query('COMMIT');

        await recordSecurityEvent({
          userId: reused.user_id,
          sessionId: reused.session_id,
          type: 'REFRESH_TOKEN_REUSE',
          severity: 'CRITICAL',
          ip,
          userAgent
        });

        throw new AppError('Phát hiện phiên đăng nhập đã bị phát lại. Tất cả phiên đã được thu hồi.', 401);
      }

      await client.query('ROLLBACK');
      throw new AppError('Phiên đăng nhập không hợp lệ.', 401);
    }

    if (session.revoked_at) {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = COALESCE(revoked_at, NOW()),
             revoke_reason = COALESCE(revoke_reason, 'REFRESH_REUSE')
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [session.user_id]
      );
      await client.query('COMMIT');

      await recordSecurityEvent({
        userId: session.user_id,
        sessionId: session.id,
        type: 'REFRESH_TOKEN_REUSE',
        severity: 'CRITICAL',
        ip,
        userAgent
      });

      throw new AppError('Phiên đăng nhập đã bị thu hồi.', 401);
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = NOW(), revoke_reason = 'EXPIRED'
         WHERE id = $1`,
        [session.id]
      );
      await client.query('COMMIT');
      throw new AppError('Phiên đăng nhập đã hết hạn.', 401);
    }

    if (session.account_status !== 'ACTIVE') {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = NOW(), revoke_reason = 'ACCOUNT_INACTIVE'
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [session.user_id]
      );
      await client.query('COMMIT');
      throw new AppError('Tài khoản không còn hoạt động.', 403);
    }

    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextHash = hashRefreshToken(nextRefreshToken);
    const nextExpiresAt = refreshExpiry();

    await client.query(
      `INSERT INTO auth_refresh_token_history (
         token_hash, session_id, user_id, rotated_at, expires_at
       ) VALUES ($1,$2,$3,NOW(),$4)
       ON CONFLICT (token_hash) DO NOTHING`,
      [tokenHash, session.id, session.user_id, session.expires_at]
    );

    await client.query(
      `UPDATE auth_sessions
       SET refresh_token_hash = $2,
           user_agent = COALESCE($3, user_agent),
           ip_hash = COALESCE($4, ip_hash),
           expires_at = $5,
           last_used_at = NOW()
       WHERE id = $1`,
      [
        session.id,
        nextHash,
        normalizeUserAgent(userAgent),
        clientIpHash(ip),
        nextExpiresAt
      ]
    );

    await client.query('COMMIT');

    return {
      session: {
        id: session.id,
        userId: session.user_id,
        email: session.email,
        role: session.role,
        twoFactorVerified: Boolean(session.two_factor_verified_at)
      },
      refreshToken: nextRefreshToken,
      expiresAt: nextExpiresAt
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors after a completed transaction.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeRefreshToken(refreshToken, reason = 'LOGOUT') {
  if (!refreshToken) return null;
  const tokenHash = hashRefreshToken(refreshToken);
  const { rows } = await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, $2)
     WHERE refresh_token_hash = $1
     RETURNING id, user_id`,
    [tokenHash, reason]
  );
  return rows[0] || null;
}

export async function revokeSession({
  userId,
  sessionId,
  reason = 'USER_REVOKED'
}) {
  const { rows } = await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, $3)
     WHERE id = $1
       AND user_id = $2
     RETURNING id`,
    [sessionId, userId, reason]
  );
  return Boolean(rows[0]);
}

export async function revokeAllSessions({
  userId,
  exceptSessionId = null,
  reason = 'USER_REVOKED_ALL'
}) {
  const params = [userId, reason];
  let exceptSql = '';
  if (exceptSessionId) {
    params.push(exceptSessionId);
    exceptSql = ' AND id <> $3';
  }

  const { rowCount } = await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, $2)
     WHERE user_id = $1
       AND revoked_at IS NULL${exceptSql}`,
    params
  );
  return rowCount;
}

export async function listActiveSessions(userId, currentSessionId = null) {
  const { rows } = await pool.query(
    `SELECT id, user_agent, created_at, last_used_at, expires_at,
            two_factor_verified_at
     FROM auth_sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     ORDER BY last_used_at DESC, created_at DESC`,
    [userId]
  );
  return rows.map((row) => publicSession(row, currentSessionId));
}

export async function markSessionTwoFactorVerified(sessionId) {
  if (!sessionId) return;
  await pool.query(
    `UPDATE auth_sessions
     SET two_factor_verified_at = NOW(), last_used_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId]
  );
}

export async function getSessionSecurityState(sessionId, userId) {
  if (!sessionId) return null;
  const { rows } = await pool.query(
    `SELECT id, two_factor_verified_at, revoked_at, expires_at
     FROM auth_sessions
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

export async function getRecentSecurityEvents(userId, limit = 12) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const { rows } = await pool.query(
    `SELECT id, event_type, severity, user_agent, metadata, created_at
     FROM security_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return rows.map((row) => ({
    id: String(row.id),
    type: row.event_type,
    severity: row.severity,
    userAgent: row.user_agent,
    metadata: row.metadata || {},
    createdAt: row.created_at
  }));
}

export async function getLoginState(userId) {
  const { rows } = await pool.query(
    `SELECT failed_attempts, locked_until, last_failed_at
     FROM auth_login_state
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || { failed_attempts: 0, locked_until: null, last_failed_at: null };
}

export async function recordFailedLogin({
  userId,
  ip,
  userAgent
}) {
  const threshold = env.loginLockThreshold;
  const lockMinutes = env.loginLockMinutes;

  const { rows } = await pool.query(
    `INSERT INTO auth_login_state (
       user_id, failed_attempts, locked_until, last_failed_at, updated_at
     ) VALUES ($1,1,NULL,NOW(),NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       failed_attempts = CASE
         WHEN auth_login_state.locked_until IS NOT NULL
              AND auth_login_state.locked_until <= NOW()
           THEN 1
         ELSE auth_login_state.failed_attempts + 1
       END,
       locked_until = CASE
         WHEN (
           CASE
             WHEN auth_login_state.locked_until IS NOT NULL
                  AND auth_login_state.locked_until <= NOW()
               THEN 1
             ELSE auth_login_state.failed_attempts + 1
           END
         ) >= $2
           THEN NOW() + ($3::text || ' minutes')::interval
         ELSE auth_login_state.locked_until
       END,
       last_failed_at = NOW(),
       updated_at = NOW()
     RETURNING failed_attempts, locked_until`,
    [userId, threshold, lockMinutes]
  );

  const state = rows[0];
  await recordSecurityEvent({
    userId,
    type: state?.locked_until ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
    severity: state?.locked_until ? 'WARN' : 'INFO',
    ip,
    userAgent,
    metadata: {
      failedAttempts: Number(state?.failed_attempts) || 1,
      lockedUntil: state?.locked_until || null
    }
  });

  return state;
}

export async function clearFailedLogins(userId) {
  await pool.query(
    `DELETE FROM auth_login_state WHERE user_id = $1`,
    [userId]
  );
}
