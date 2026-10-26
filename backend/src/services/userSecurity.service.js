import { randomBytes } from 'node:crypto';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import {
  decryptSecuritySecret,
  encryptSecuritySecret,
  hashSensitiveValue
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
const RECOVERY_SCOPE = '2fa-recovery-code';
const RECOVERY_CODE_COUNT = 10;

function rowPayload(row) {
  if (!row?.two_factor_secret_ciphertext) return null;
  return {
    ciphertext: row.two_factor_secret_ciphertext,
    iv: row.two_factor_secret_iv,
    authTag: row.two_factor_secret_auth_tag
  };
}

function normalizeRecoveryCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function recoveryCodeHash(value) {
  return hashSensitiveValue(normalizeRecoveryCode(value), RECOVERY_SCOPE);
}

function createRecoveryCode() {
  const raw = randomBytes(8).toString('hex').toUpperCase();
  return raw.match(/.{1,4}/g).join('-');
}

async function replaceRecoveryCodes(userId, client = pool) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, createRecoveryCode);

  await client.query(
    'DELETE FROM two_factor_recovery_codes WHERE user_id = $1',
    [userId]
  );

  for (const code of codes) {
    await client.query(
      `INSERT INTO two_factor_recovery_codes (user_id, code_hash)
       VALUES ($1,$2)`,
      [userId, recoveryCodeHash(code)]
    );
  }

  return codes;
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
  const [row, recovery] = await Promise.all([
    getUserSecurityRow(user.id),
    pool.query(
      `SELECT COUNT(*)::int AS remaining
       FROM two_factor_recovery_codes
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    )
  ]);

  const enabled = Boolean(row?.two_factor_enabled);

  return {
    twoFactorEnabled: enabled,
    adminTwoFactorSetupRequired: user.role === 'ADMIN' && !enabled,
    recoveryCodesRemaining: Number(recovery.rows[0]?.remaining || 0)
  };
}

export async function getEnabledTotpSecret(userId) {
  const row = await getUserSecurityRow(userId);
  if (!row?.two_factor_enabled) return null;
  return decryptSecuritySecret(rowPayload(row), TOTP_SCOPE);
}

export async function consumeRecoveryCode(userId, code, client = pool) {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length < 12) return false;

  const { rows } = await client.query(
    `UPDATE two_factor_recovery_codes
     SET used_at = NOW()
     WHERE user_id = $1
       AND code_hash = $2
       AND used_at IS NULL
     RETURNING id`,
    [userId, recoveryCodeHash(normalized)]
  );

  return Boolean(rows[0]);
}

export async function beginTwoFactorSetup({
  user,
  sessionId,
  ip,
  userAgent
}) {
  const current = await getUserSecurityRow(user.id);
  if (current?.two_factor_enabled) {
    throw new AppError('Xác thực hai lớp đã được bật cho tài khoản này.', 409);
  }

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

  const client = await pool.connect();
  let recoveryCodes;

  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE user_security
       SET two_factor_enabled = TRUE,
           two_factor_enabled_at = NOW(),
           two_factor_updated_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    recoveryCodes = await replaceRecoveryCodes(userId, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await markSessionTwoFactorVerified(sessionId);

  await recordSecurityEvent({
    userId,
    sessionId,
    type: 'TWO_FACTOR_ENABLED',
    severity: 'WARN',
    ip,
    userAgent,
    metadata: { recoveryCodesIssued: recoveryCodes.length }
  });

  return { recoveryCodes };
}

export async function regenerateRecoveryCodes({
  userId,
  sessionId,
  code,
  ip,
  userAgent
}) {
  const secret = await getEnabledTotpSecret(userId);
  if (!secret || !verifyTotp(secret, code)) {
    throw new AppError('Mã xác thực hai lớp không đúng.', 400);
  }

  const recoveryCodes = await replaceRecoveryCodes(userId);

  await recordSecurityEvent({
    userId,
    sessionId,
    type: 'TWO_FACTOR_RECOVERY_CODES_REGENERATED',
    severity: 'WARN',
    ip,
    userAgent,
    metadata: { recoveryCodesIssued: recoveryCodes.length }
  });

  return { recoveryCodes };
}

export async function disableTwoFactor({
  userId,
  sessionId,
  code,
  recoveryCode,
  ip,
  userAgent
}) {
  const row = await getUserSecurityRow(userId);
  const secret = decryptSecuritySecret(rowPayload(row), TOTP_SCOPE);

  let verified = Boolean(
    row?.two_factor_enabled &&
    secret &&
    code &&
    verifyTotp(secret, code)
  );

  if (!verified && recoveryCode) {
    verified = await consumeRecoveryCode(userId, recoveryCode);
  }

  if (!verified) {
    throw new AppError('Mã xác thực hai lớp hoặc mã khôi phục không đúng.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
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
    await client.query(
      'DELETE FROM two_factor_recovery_codes WHERE user_id = $1',
      [userId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

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
