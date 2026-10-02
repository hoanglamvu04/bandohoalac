import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pool } from '../database/pool.js';
import { stageOvertureFeatures } from '../services/placeImport.service.js';

function arg(name, fallback = null) {
  const prefix = '--' + name + '=';
  const direct = process.argv.find((item) => item.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const index = process.argv.indexOf('--' + name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return fallback;
}

async function run() {
  const fileArg = arg('file');
  const minConfidence = Number(arg('min-confidence', '0.55'));

  if (!fileArg) {
    throw new Error('Missing --file <path-to-overture-places.geojson>.');
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const document = JSON.parse(readFileSync(filePath, 'utf8'));
  const features = Array.isArray(document?.features) ? document.features : [];

  if (!features.length) {
    throw new Error('GeoJSON contains no features.');
  }

  console.log('Hola Maps Overture Places import');
  console.log('File:', filePath);
  console.log('Features:', features.length);
  console.log('Minimum confidence:', minConfidence);

  const stats = await stageOvertureFeatures(features, { minConfidence });

  console.log('');
  console.log('Import finished.');
  console.table(stats);
  console.log('Open /admin/place-imports to review and approve records.');
}

run()
  .catch((error) => {
    console.error('Overture Places import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
