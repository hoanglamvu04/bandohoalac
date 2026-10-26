import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(
    { ...payload, typ: 'access' },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      issuer: 'hola-maps',
      audience: 'hola-maps-web'
    }
  );
}

export const signToken = signAccessToken;

export function verifyToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, {
    issuer: 'hola-maps',
    audience: 'hola-maps-web'
  });

  if (payload?.typ !== 'access' || !payload?.sid) {
    throw new Error('Invalid access token.');
  }

  return payload;
}
