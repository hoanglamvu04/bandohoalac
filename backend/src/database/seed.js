import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { env } from '../config/env.js';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Refusing to apply development seed.sql while NODE_ENV=production.'
    );
  }

  const seedSql = readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  console.log('Applying seed.sql...');
  await pool.query(seedSql);
  console.log('Seed data applied successfully.');
  await pool.end();
}

run().catch(async (error) => {
  console.error('Seeding failed:', error.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
