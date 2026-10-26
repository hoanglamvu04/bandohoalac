import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const DUMMY_HASH_PROMISE = bcrypt.hash(
  'hola-maps-dummy-password-never-authenticates',
  SALT_ROUNDS
);

export function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function compareDummyPassword(plain) {
  const hash = await DUMMY_HASH_PROMISE;
  return bcrypt.compare(String(plain || ''), hash);
}
