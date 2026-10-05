import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSqlFile(filePath, label) {
  const sql = readFileSync(filePath, 'utf8');
  console.log('Applying ' + label + '...');
  await pool.query(sql);
  console.log(label + ' applied successfully.');
}

async function run() {
  const shouldSeed = process.argv.includes('--seed');

  await runSqlFile(path.join(__dirname, 'schema.sql'), 'schema.sql');

  const migrationsDir = path.join(__dirname, 'migrations');
  if (existsSync(migrationsDir)) {
    const migrations = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const migration of migrations) {
      await runSqlFile(path.join(migrationsDir, migration), 'migration ' + migration);
    }
  }

  if (shouldSeed) {
    await runSqlFile(path.join(__dirname, 'seed.sql'), 'seed.sql');
  }

  await pool.end();
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
