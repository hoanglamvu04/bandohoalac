import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';

function arg(name, fallback) {
  const prefix = '--' + name + '=';
  const direct = process.argv.find((item) => item.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const index = process.argv.indexOf('--' + name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return fallback;
}

function cloudinaryVariantUrl(url, transformation) {
  const marker = '/image/upload/';
  if (!url || !String(url).includes(marker)) return null;
  return String(url).replace(marker, marker + transformation + '/');
}

function publicUploadUrl(filename) {
  return String(env.publicBaseUrl || '').replace(/\/$/, '') +
    '/uploads/' + encodeURIComponent(filename);
}

function filenameFromUrl(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(new URL(value).pathname.split('/').pop() || '') || null;
  } catch {
    return null;
  }
}

function runCwebp(inputFile, outputFile, width, quality) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'cwebp',
      [
        '-quiet',
        '-metadata', 'none',
        '-q', String(quality),
        '-resize', String(width), '0',
        inputFile,
        '-o', outputFile
      ],
      { stdio: 'ignore', windowsHide: true }
    );

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('cwebp exited with code ' + code));
    });
  });
}

async function localVariants(row) {
  const filename = row.storage_public_id || filenameFromUrl(row.url);
  if (!filename) return null;

  const sourcePath = path.resolve(process.cwd(), env.uploadDir, filename);
  await access(sourcePath);

  const parsed = path.parse(filename);
  const thumbnailFilename = parsed.name + '-thumb.webp';
  const cardFilename = parsed.name + '-card.webp';
  const thumbnailPath = path.resolve(process.cwd(), env.uploadDir, thumbnailFilename);
  const cardPath = path.resolve(process.cwd(), env.uploadDir, cardFilename);

  await runCwebp(sourcePath, thumbnailPath, 320, 72);
  await runCwebp(sourcePath, cardPath, 960, 82);

  return {
    thumbnailUrl: publicUploadUrl(thumbnailFilename),
    cardUrl: publicUploadUrl(cardFilename)
  };
}

async function run() {
  const limit = Math.min(Math.max(Number(arg('limit', 250)) || 250, 1), 2000);

  const { rows } = await pool.query(
    `SELECT
       id,
       url,
       storage_provider,
       storage_public_id,
       thumbnail_url,
       card_url
     FROM place_images
     WHERE thumbnail_url IS NULL OR card_url IS NULL
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  );

  const stats = {
    found: rows.length,
    updated: 0,
    cloudinary: 0,
    local: 0,
    skipped: 0,
    failed: 0
  };

  for (const row of rows) {
    try {
      let variants = null;
      const provider = String(row.storage_provider || '').toLowerCase();

      if (provider === 'cloudinary' || String(row.url || '').includes('res.cloudinary.com')) {
        const thumbnailUrl = cloudinaryVariantUrl(
          row.url,
          'c_fill,g_auto,w_320,h_220,f_webp,q_auto:eco'
        );
        const cardUrl = cloudinaryVariantUrl(
          row.url,
          'c_limit,w_960,f_webp,q_auto:good'
        );

        if (thumbnailUrl && cardUrl) {
          variants = { thumbnailUrl, cardUrl };
          stats.cloudinary += 1;
        }
      } else if (provider === 'local' || row.storage_public_id) {
        variants = await localVariants(row);
        if (variants) stats.local += 1;
      }

      if (!variants) {
        stats.skipped += 1;
        continue;
      }

      await pool.query(
        `UPDATE place_images
         SET thumbnail_url = COALESCE(thumbnail_url, $2),
             card_url = COALESCE(card_url, $3)
         WHERE id = $1`,
        [row.id, variants.thumbnailUrl, variants.cardUrl]
      );
      stats.updated += 1;
    } catch (error) {
      stats.failed += 1;
      console.warn('Image #' + row.id + ' backfill failed:', error.message);
    }
  }

  console.log('Hola Maps place image variant backfill');
  console.table(stats);
}

run()
  .catch((error) => {
    console.error('Image variant backfill failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
