import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import {
  decryptSecuritySecret,
  encryptSecuritySecret
} from './securityCrypto.service.js';
import {
  buildTotpUri,
  generateTotpSecret,
  verifyTotp
} from './totp.service.js';
import {
  markSessionTwoFactorVerified,
  recordSecurityEvent,
  revokeAllSessions
} from './authSession.service.js';

const TOTP_SCOPE = 'admin-totp';

function rowPayload(row) {
  if (!row?.two_factor_secret_ciphertext) return null;
  return {
    ciphertext: row.two_factor_secret_ciphertext,
    iv: row.two_factor_secret_iv,
    authTag: row.two_factor_secret_auth_tag
  };
}

export async function getUserSecurityRow(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT user_id, two_factor_secret_ciphertext, two_factor_secret_iv,
            two_factor_secret_auth_tag, two_factor_enabled,
            two_factor_enabled_at, two_factor_updated_at
     FROM user_security
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getAuthSecuritySummary(user) {
  const row = await getUserSecurityRow(user.id);
  const enabled = Boolean(row?.two_factor_enabled);

  return {
    twoFactorEnabled: enabled,
    adminTwoFactorSetupRequired: user.role === 'ADMIN' && !enabled
  };
}

export async function getEnabledTotpSecret(userId) {
  const row = await getUserSecurityRow(userId);
  if (!row?.two_factor_enabled) return null;
  return decryptSecuritySecret(rowPayload(row), TOTP_SCOPE);
}

export async function beginTwoFactorSetup({
  user,
  sessionId,
  ip,
  userAgent
}) {
  const secret = generateTotpSecret();
  const encrypted = encryptSecuritySecret(secret, TOTP_SCOPE);

  await pool.query(
    `INSERT INTO user_security (
       user_id, two_factor_secret_ciphertext, two_factor_secret_iv,
       two_factor_secret_auth_tag, two_factor_enabled,
       two_factor_enabled_at, two_factor_updated_at, updated_at
     ) VALUES ($1,$2,$3,$4,FALSE,NULL,NOW(),NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       two_factor_secret_ciphertext = EXCLUDED.two_factor_secret_ciphertext,
       two_factor_secret_iv = EXCLUDED.two_factor_secret_iv,
       two_factor_secret_auth_tag = EXCLUDED.two_factor_secret_auth_tag,
       two_factor_enabled = FALSE,
       two_factor_enabled_at = NULL,
       two_factor_updated_at = NOW(),
       updated_at = NOW()`,
    [user.id, encrypted.ciphertext, encrypted.iv, encrypted.authTag]
  );

  await recordSecurityEvent({
    userId: user.id,
    sessionId,
    type: 'TWO_FACTOR_SETUP_STARTED',
    ip,
    userAgent
  });

  return {
    secret,
    otpauthUri: buildTotpUri({
      secret,
      email: user.email,
      issuer: 'HOLA Maps'
    })
  };
}

export async function confirmTwoFactorSetup({
  userId,
  sessionId,
  code,
  ip,
  userAgent
}) {
  const row = await getUserSecurityRow(userId);
  const secret = decryptSecuritySecret(rowPayload(row), TOTP_SCOPE);

  if (!secret || !verifyTotp(secret, code)) {
    throw new AppError('Mã xác thực không đúng. Hãy kiểm tra lại ứng dụng Authenticator.', 400);
  }

  await pool.query(
    `UPDATE user_security
     SET two_factor_enabled = TRUE,
         two_factor_enabled_at = NOW(),
         two_factor_updated_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );

  await markSessionTwoFactorVerified(sessionId);

  await recordSecurityEvent({
    userId,
    sessionId,
    type: 'TWO_FACTOR_ENABLED',
    severity: 'WARN',
    ip,
    userAgent
  });

  return true;
}

export async function disableTwoFactor({
  userId,
  sessionId,
  code,
  ip,
  userAgent
}) {
  const row = await getUserSecurityRow(userId);
  const secret = decryptSecuritySecret(rowPayload(row), TOTP_SCOPE);

  if (!row?.two_factor_enabled || !secret || !verifyTotp(secret, code)) {
    throw new AppError('Mã xác thực hai lớp không đúng.', 400);
  }

  await pool.query(
    `UPDATE user_security
     SET two_factor_secret_ciphertext = NULL,
         two_factor_secret_iv = NULL,
         two_factor_secret_auth_tag = NULL,
         two_factor_enabled = FALSE,
         two_factor_enabled_at = NULL,
         two_factor_updated_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );

  await revokeAllSessions({
    userId,
    exceptSessionId: sessionId,
    reason: 'TWO_FACTOR_DISABLED'
  });

  await pool.query(
    `UPDATE auth_sessions
     SET two_factor_verified_at = NULL
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  await recordSecurityEvent({
    userId,
    sessionId,
    type: 'TWO_FACTOR_DISABLED',
    severity: 'CRITICAL',
    ip,
    userAgent
  });

  return true;
}
