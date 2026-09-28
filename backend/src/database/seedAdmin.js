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

async function run() {
  const email = (process.env.ADMIN_SEED_EMAIL || 'admin@holamaps.vn')
    .trim()
    .toLowerCase();
  const name = (process.env.ADMIN_SEED_NAME || 'Hola Admin').trim();
  const password = required('ADMIN_SEED_PASSWORD');

  if (password.length < 8) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 8 characters.');
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
