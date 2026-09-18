import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const seedSql = readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  console.log('Applying seed.sql...');
  await pool.query(seedSql);
  console.log('Seed data applied successfully.');
  await pool.end();
}

run().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
