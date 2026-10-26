import dotenv from 'dotenv';
import { pool } from './pool.js';
import { hashPassword } from '../utils/password.js';

dotenv.config();

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(
      'Missing ' + name + '. Add it to backend/.env before running db:seed:admin.'
    );
  }
  return value;
}

function strongAdminPassword(password) {
  const groups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;

  return password.length >= 12 && groups >= 3;
}

async function run() {
  const production = String(process.env.NODE_ENV || '').trim() === 'production';
  if (
    production &&
    String(process.env.ALLOW_ADMIN_SEED_IN_PRODUCTION || '').trim().toLowerCase() !== 'true'
  ) {
    throw new Error(
      'Refusing to create or reset an admin in production without ALLOW_ADMIN_SEED_IN_PRODUCTION=true.'
    );
  }

  const email = (process.env.ADMIN_SEED_EMAIL || 'admin@holamaps.vn')
    .trim()
    .toLowerCase();
  const name = (process.env.ADMIN_SEED_NAME || 'Hola Admin').trim();
  const password = required('ADMIN_SEED_PASSWORD');

  if (!strongAdminPassword(password)) {
    throw new Error(
      'ADMIN_SEED_PASSWORD must be at least 12 characters and use at least 3 groups: lowercase, uppercase, number, symbol.'
    );
  }

  const passwordHash = await hashPassword(password);

  const { rows } = await pool.query(
    `INSERT INTO users (
       name,
       email,
       password_hash,
       role,
       bio,
       trust_score,
       updated_at
     )
     VALUES ($1, $2, $3, 'ADMIN', $4, 100, NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'ADMIN',
       trust_score = GREATEST(users.trust_score, 100),
       updated_at = NOW()
     RETURNING id, name, email, role, trust_score, created_at, updated_at`,
    [
      name,
      email,
      passwordHash,
      'Quản trị hệ thống Hola Maps.'
    ]
  );

  const admin = rows[0];

  console.log('');
  console.log('Hola Maps admin seed completed.');
  console.log('--------------------------------');
  console.log('ID:    ' + admin.id);
  console.log('Name:  ' + admin.name);
  console.log('Email: ' + admin.email);
  console.log('Role:  ' + admin.role);
  console.log('');
  console.log('Password was read from ADMIN_SEED_PASSWORD and is not printed.');
  if (production) {
    console.log('Production admin seed was explicitly authorized for this run.');
  }
  console.log('You can now sign in through the normal Hola Maps login page.');
}

run()
  .catch((error) => {
    console.error('Admin seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
