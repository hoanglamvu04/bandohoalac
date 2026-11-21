import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';

const MAX_ROWS = 500;
const MAX_SAMPLES = 20;

export async function inspectHousingImageUrl(urlValue, {
  publicBaseUrl = env.publicBaseUrl,
  uploadDir = path.resolve(process.cwd(), env.uploadDir),
  fileStat = stat
} = {}) {
  if (!urlValue || typeof urlValue !== 'string') return 'MISSING_URL';

  let url;
  let base;
  try {
    base = new URL(publicBaseUrl);
    url = new URL(urlValue, publicBaseUrl);
  } catch {
    return 'INVALID_URL';
  }
  if (!['http:', 'https:'].includes(url.protocol)) return 'INVALID_URL';

  // Never fetch URLs from users or the database: that would introduce SSRF.
  // Cloudinary and third-party media still need HTTPS browser verification.
  if (url.hostname === 'res.cloudinary.com' && url.protocol === 'https:') {
    return 'REMOTE_UNVERIFIED';
  }
  if (!url.pathname.startsWith('/uploads/')) return 'REMOTE_UNVERIFIED';
  if (url.origin !== base.origin) return 'PUBLIC_ORIGIN_MISMATCH';

  let filename;
  try {
    filename = decodeURIComponent(url.pathname.slice('/uploads/'.length));
  } catch {
    return 'INVALID_URL';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) ||
      filename === '.' || filename === '..' || filename.startsWith('.')) {
    return 'INVALID_URL';
  }

  try {
    const item = await fileStat(path.join(uploadDir, filename));
    return item.isFile() && item.size > 0 ? 'LOCAL_FILE_OK' : 'LOCAL_FILE_MISSING';
  } catch {
    return 'LOCAL_FILE_MISSING';
  }
}

export async function auditHousingPublication({
  client = pool,
  fileStat = stat,
  publicBaseUrl = env.publicBaseUrl,
  uploadDir = path.resolve(process.cwd(), env.uploadDir),
  limit = 100
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), MAX_ROWS);
  const { rows } = await client.query(
    `SELECT p.id, p.slug, p.name, p.status,
            ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
            ST_Intersects(p.location,
              ST_SetSRID(ST_GeomFromGeoJSON($1),4326)) AS inside_coverage,
            hl.place_id AS housing_id, hl.listing_status, hl.expires_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                'url', pi.url,
                'thumbnailUrl', pi.thumbnail_url,
                'cardUrl', pi.card_url
              ) ORDER BY pi.is_cover DESC, pi.id)
              FROM place_images pi WHERE pi.place_id = p.id
            ), '[]'::json) AS images
       FROM places p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN housing_listings hl ON hl.place_id = p.id
       WHERE c.slug = 'bat-dong-san' AND p.status = 'PUBLISHED'
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $2`,
    [SERVICE_AREA_GEOJSON_STRING, cap]
  );

  const checkedAt = new Date().toISOString();
  const summary = {
    publishedPropertiesChecked: rows.length,
    mapAndHousingReady: 0,
    hiddenOrExpiredListings: 0,
    missingHousingProfiles: 0,
    outsideCoverage: 0,
    propertiesWithoutPhotos: 0,
    missingLocalFiles: 0,
    publicOriginMismatches: 0,
    invalidImageUrls: 0,
    remoteMediaNotVerified: 0
  };
  const issues = [];

  for (const row of rows) {
    const problems = [];
    const housingActive = row.housing_id != null &&
      row.listing_status === 'ACTIVE' &&
      (row.expires_at == null || new Date(row.expires_at).getTime() > Date.now());
    if (row.housing_id == null) {
      summary.missingHousingProfiles += 1;
      problems.push('NO_HOUSING_PROFILE');
    } else if (!housingActive) {
      summary.hiddenOrExpiredListings += 1;
      problems.push('LISTING_INACTIVE_OR_EXPIRED');
    }
    if (!row.inside_coverage || !Number.isFinite(Number(row.lat)) ||
        !Number.isFinite(Number(row.lng))) {
      summary.outsideCoverage += 1;
      problems.push('OUTSIDE_COVERAGE');
    }
    if (housingActive && row.inside_coverage) summary.mapAndHousingReady += 1;

    const images = Array.isArray(row.images) ? row.images : [];
    if (!images.length) {
      summary.propertiesWithoutPhotos += 1;
      problems.push('NO_PHOTOS');
    }
    const inspected = new Map();
    for (const asset of images) {
      // Verify each distinct public variant. The same URL may be used for
      // original, thumbnail and card without requiring three disk reads.
      for (const url of [asset.url, asset.thumbnailUrl, asset.cardUrl]) {
        if (!url || inspected.has(url)) continue;
        const result = await inspectHousingImageUrl(url, {
          fileStat, publicBaseUrl, uploadDir
        });
        inspected.set(url, result);
        if (result === 'LOCAL_FILE_MISSING') {
          summary.missingLocalFiles += 1;
          problems.push('LOCAL_FILE_MISSING');
        } else if (result === 'PUBLIC_ORIGIN_MISMATCH') {
          summary.publicOriginMismatches += 1;
          problems.push('PUBLIC_ORIGIN_MISMATCH');
        } else if (result === 'INVALID_URL' || result === 'MISSING_URL') {
          summary.invalidImageUrls += 1;
          problems.push('INVALID_IMAGE_URL');
        } else if (result === 'REMOTE_UNVERIFIED') {
          summary.remoteMediaNotVerified += 1;
        }
      }
    }
    if (problems.length && issues.length < MAX_SAMPLES) {
      // Never expose private contact data, full filenames or stored URLs.
      issues.push({ placeId: Number(row.id), reasons: [...new Set(problems)] });
    }
  }

  const blockers = summary.missingHousingProfiles + summary.hiddenOrExpiredListings +
    summary.outsideCoverage + summary.missingLocalFiles +
    summary.publicOriginMismatches + summary.invalidImageUrls;

  return {
    mode: 'READ_ONLY',
    checkedAt,
    uploadProvider: env.uploadProvider,
    limit: cap,
    summary,
    releaseBlockers: blockers,
    sampleIssues: issues,
    note: 'Disk checks do not prove Nginx/CDN delivery. Verify real image URLs over HTTPS after deployment.'
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const value = process.argv.find((arg) => /^--limit=\d+$/.test(arg));
  const limit = value ? Number(value.split('=')[1]) : 100;
  auditHousingPublication({ limit })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.releaseBlockers > 0) process.exitCode = 2;
    })
    .catch((error) => {
      console.error('[housing-publication-audit]', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
