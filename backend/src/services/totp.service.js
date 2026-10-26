import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../utils/AppError.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');

  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value) {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');

  let bits = '';
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new AppError('Mã bảo mật 2FA không hợp lệ.', 400);
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret, counter, digits = 6) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  let value = BigInt(counter);

  for (let index = 7; index >= 0; index -= 1) {
    buffer[index] = Number(value & 0xffn);
    value >>= 8n;
  }

  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % (10 ** digits)).padStart(digits, '0');
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret, timestamp = Date.now()) {
  return hotp(secret, Math.floor(timestamp / 1000 / 30));
}

export function verifyTotp(secret, code, {
  timestamp = Date.now(),
  window = 1
} = {}) {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  const provided = Buffer.from(normalized);
  const counter = Math.floor(timestamp / 1000 / 30);

  for (let drift = -window; drift <= window; drift += 1) {
    const expected = Buffer.from(hotp(secret, counter + drift));
    if (
      expected.length === provided.length &&
      timingSafeEqual(expected, provided)
    ) {
      return true;
    }
  }

  return false;
}

export function buildTotpUri({
  secret,
  email,
  issuer = 'HOLA Maps'
}) {
  const label = encodeURIComponent(issuer + ':' + String(email || 'admin'));
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return 'otpauth://totp/' + label + '?' + params.toString();
}
