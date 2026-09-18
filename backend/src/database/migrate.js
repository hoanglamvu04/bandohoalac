import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const shouldSeed = process.argv.includes('--seed');

  const schemaSql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql...');
  await pool.query(schemaSql);
  console.log('Schema applied successfully.');

  if (shouldSeed) {
    const seedSql = readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    console.log('Applying seed.sql...');
    await pool.query(seedSql);
    console.log('Seed data applied successfully.');
  }

  await pool.end();
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
