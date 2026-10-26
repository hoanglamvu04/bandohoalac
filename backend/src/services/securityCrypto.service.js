import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes
} from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
let warnedLegacySecurityKey = false;

function rawSecuritySecret() {
  const configured = String(env.securityEncryptionKey || '').trim();
  if (configured) return configured;

  if (env.nodeEnv === 'production' && !warnedLegacySecurityKey) {
    warnedLegacySecurityKey = true;
    console.warn(
      '[Hola Maps] SECURITY_ENCRYPTION_KEY is not configured; temporarily falling back to JWT_SECRET. ' +
      'Set a dedicated key in production, then rotate stored secrets.'
    );
  }

  return String(env.jwtSecret || '');
}

function deriveKey(secret) {
  return createHash('sha256')
    .update('hola-maps:security:v1:')
    .update(String(secret || ''))
    .digest();
}

function aad(scope) {
  return Buffer.from('hola-maps:' + String(scope || 'secret'), 'utf8');
}

export function encryptSecuritySecret(value, scope = 'secret') {
  const plaintext = String(value || '');
  if (!plaintext) throw new Error('Cannot encrypt an empty secret.');

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(rawSecuritySecret()), iv);
  cipher.setAAD(aad(scope));

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

function decryptWithSecret(payload, scope, secret) {
  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(secret),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAAD(aad(scope));
  decipher.setAuthTag(Buffer.from(payload.authTag || payload.auth_tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function decryptSecuritySecret(payload, scope = 'secret', {
  allowLegacyJwtKey = true
} = {}) {
  if (!payload?.ciphertext || !payload?.iv || !(payload?.authTag || payload?.auth_tag)) {
    return null;
  }

  const configured = String(env.securityEncryptionKey || '').trim();
  const candidates = [
    configured || String(env.jwtSecret || '')
  ];

  if (
    allowLegacyJwtKey &&
    configured &&
    configured !== String(env.jwtSecret || '')
  ) {
    candidates.push(String(env.jwtSecret || ''));
  }

  let lastError = null;
  for (const secret of candidates) {
    try {
      return decryptWithSecret(payload, scope, secret);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to decrypt secret.');
}

export function hashSensitiveValue(value, scope = 'value') {
  return createHmac('sha256', deriveKey(rawSecuritySecret()))
    .update(String(scope))
    .update(':')
    .update(String(value || ''))
    .digest('hex');
}
