import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';

const KNOWN_SANITIZED_SUFFIX = /-(?:thumb|card|clean)\.webp$/i;
const ORIGINAL_EXTENSIONS = /\.(?:jpe?g|png|gif|tiff?|heic|avif)$/i;

export function classifyPublicImageAsset(asset, publicBaseUrl) {
  const provider = String(asset?.storage_provider || '').toLowerCase();
  const value = String(asset?.url || '').trim();
  if (!value) return 'MISSING_URL';

  let url;
  let base;
  try {
    url = new URL(value, publicBaseUrl);
    base = new URL(publicBaseUrl);
  } catch {
    return 'INVALID_URL';
  }

  if (provider === 'cloudinary' || url.hostname === 'res.cloudinary.com') {
    // A transformed URL does not prove the original file's EXIF was stripped.
    return 'CLOUDINARY_ORIGINAL_UNVERIFIED';
  }

  if (url.origin === base.origin && url.pathname.startsWith('/uploads/')) {
    let basename;
    try {
      basename = decodeURIComponent(url.pathname.slice('/uploads/'.length));
    } catch {
      return 'INVALID_URL';
    }
    if (basename.includes('/') || basename.includes('\\') || !basename) {
      return 'INVALID_URL';
    }
    if (ORIGINAL_EXTENSIONS.test(basename)) return 'LOCAL_RAW_PUBLIC';
    if (KNOWN_SANITIZED_SUFFIX.test(basename)) return 'LOCAL_VARIANT_REVIEW';
    return 'LOCAL_OTHER_UNVERIFIED';
  }

  return 'EXTERNAL_UNVERIFIED';
}

export async function scanLegacyLocalUploads(uploadDir, maxFiles = 3000) {
  const names = await readdir(uploadDir, { withFileTypes: true });
  const max = Math.min(Math.max(Number(maxFiles) || 3000, 1), 20000);
  const files = names.filter((entry) => entry.isFile());
  const originals = files.filter((entry) => ORIGINAL_EXTENSIONS.test(entry.name));
  const stats = {
    totalFiles: files.length,
    rawFormatFiles: originals.length,
    metadataMarkerFiles: 0,
    scannedRawFiles: 0,
    unreadable: 0,
    skippedLarge: 0,
    truncated: originals.length > max
  };

  for (const item of originals.slice(0, max)) {
    const filename = path.join(uploadDir, item.name);
    try {
      const descriptor = await open(filename, 'r');
      try {
        const info = await descriptor.stat();
        if (info.size > 24 * 1024 * 1024) {
          stats.skippedLarge += 1;
          continue;
        }
        const buffer = Buffer.alloc(Math.min(info.size, 256 * 1024));
        const { bytesRead } = await descriptor.read(buffer, 0, buffer.length, 0);
        const contents = buffer.subarray(0, bytesRead);
        if (contents.includes(Buffer.from('Exif\0\0')) ||
            contents.includes(Buffer.from('GPSInfo')) ||
            contents.includes(Buffer.from('http://ns.adobe.com/xap/1.0/'))) {
          stats.metadataMarkerFiles += 1;
        }
        stats.scannedRawFiles += 1;
      } finally {
        await descriptor.close();
      }
    } catch {
      stats.unreadable += 1;
    }
  }
  return stats;
}

export async function collectLegacyMediaAudit({
  client = pool,
  publicBaseUrl = env.publicBaseUrl,
  uploadProvider = env.uploadProvider,
  uploadDir = path.resolve(env.uploadDir),
  limit = 10000
} = {}) {
  const max = Math.min(Math.max(Number(limit) || 10000, 1), 50000);
  const [{ rows }, { rows: [summary] }] = await Promise.all([
    client.query(
      'SELECT id, url, storage_provider FROM place_images ORDER BY id ASC LIMIT $1',
      [max]
    ),
    client.query('SELECT COUNT(*)::int AS total FROM place_images')
  ]);

  const kinds = {};
  for (const row of rows) {
    const classification = classifyPublicImageAsset(row, publicBaseUrl);
    kinds[classification] = (kinds[classification] || 0) + 1;
  }
  const disk = uploadProvider === 'local'
    ? await scanLegacyLocalUploads(uploadDir, max)
    : null;

  return {
    mode: 'READ_ONLY',
    checkedAt: new Date().toISOString(),
    providerConfigured: uploadProvider,
    databaseImageCount: Number(summary?.total || 0),
    imageRecordsAudited: rows.length,
    recordsTruncated: Number(summary?.total || 0) > rows.length,
    classifications: kinds,
    localDisk: disk,
    launchWarnings: [
      ...(kinds.LOCAL_RAW_PUBLIC ? ['Some public local images may expose raw metadata.'] : []),
      ...(kinds.CLOUDINARY_ORIGINAL_UNVERIFIED ? ['Cloudinary originals need independent review or provider-side export.'] : []),
      ...(kinds.EXTERNAL_UNVERIFIED || kinds.LOCAL_OTHER_UNVERIFIED || kinds.INVALID_URL || kinds.MISSING_URL
        ? ['Some public image URLs or WebP originals cannot be independently verified.'] : []),
      ...(disk?.rawFormatFiles ? ['Legacy original-format image files remain on local disk.'] : []),
      ...(Number(summary?.total || 0) > rows.length || disk?.truncated ? ['Audit sample was truncated: scan all items before launch.'] : [])
    ],
    note: 'No images were modified or downloaded; missing evidence is NOT proof that metadata is absent.'
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collectLegacyMediaAudit()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (process.argv.includes('--strict') && result.launchWarnings.length) process.exitCode = 2;
    })
    .catch((error) => {
      console.error('[legacy-media-audit]', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
