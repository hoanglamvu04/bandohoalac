import { pool } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { resolveIntegrationSecret } from './integrationSecrets.service.js';
import {
  approvePhotoCandidate,
  getPhotoScannerStats,
  listPhotoCandidates,
  listPhotoScanRuns,
  photoNameSimilarity,
  rejectPhotoCandidate
} from './photoScanner.service.js';

export {
  approvePhotoCandidate,
  getPhotoScannerStats,
  listPhotoCandidates,
  listPhotoScanRuns,
  rejectPhotoCandidate
};

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const FOURSQUARE_API = 'https://places-api.foursquare.com';
const FOURSQUARE_VERSION = '2025-06-17';

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function metaValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value || metadata?.[key] || '');
}

function resolutionScore(width, height) {
  const pixels = Math.max(Number(width) || 0, 0) * Math.max(Number(height) || 0, 0);
  if (pixels >= 3000000) return 1;
  if (pixels >= 1600000) return 0.9;
  if (pixels >= 800000) return 0.75;
  if (pixels >= 350000) return 0.55;
  return 0.25;
}

function aspectScore(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) return 0.4;
  const ratio = w / h;
  if (ratio >= 1.25 && ratio <= 2.2) return 1;
  if (ratio >= 0.9 && ratio <= 2.8) return 0.7;
  return 0.35;
}

function normalizeClassifications(value) {
  const raw = Array.isArray(value) ? value : (value ? [value] : []);
  return raw
    .map((entry) => typeof entry === 'string'
      ? entry
      : (entry?.classification || entry?.name || entry?.type || ''))
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);
}

function classificationScore(value) {
  const classes = normalizeClassifications(value);
  if (classes.some((item) => item.includes('logo') || item.includes('menu'))) return -1;
  if (classes.some((item) => item.includes('storefront') || item.includes('building_exterior'))) return 1;
  if (classes.some((item) => item.includes('outdoor_building') || item.includes('landmark'))) return 0.92;
  if (classes.some((item) => item.includes('outdoor') || item.includes('scenery'))) return 0.82;
  if (classes.some((item) => item.includes('indoor') || item.includes('ambience'))) return 0.62;
  if (classes.some((item) => item.includes('food') || item.includes('drink'))) return 0.45;
  return 0.5;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => Number(value) * Math.PI / 180;
  const earth = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isFoursquareMatchAcceptable(placeName, resultName, distanceMeters) {
  const distance = Number(distanceMeters);
  const similarity = photoNameSimilarity(placeName, resultName);
  const left = normalize(placeName);
  const right = normalize(resultName);
  const contains = left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left));

  if (!Number.isFinite(distance) || distance > 1200) return false;
  if (distance <= 180 && (contains || similarity >= 0.18)) return true;
  if (distance <= 450 && (contains || similarity >= 0.26)) return true;
  if (distance <= 800 && similarity >= 0.36) return true;
  return distance <= 1200 && similarity >= 0.52;
}

class ProviderHttpError extends Error {
  constructor(provider, status) {
    super(provider + ' returned HTTP ' + status);
    this.provider = provider;
    this.status = Number(status) || null;
  }
}

async function fetchJson(provider, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.photoScanRequestTimeoutMs || 9000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HolaMaps-PhotoScanner/2.0',
        ...(options.headers || {})
      }
    });
    if (!response.ok) throw new ProviderHttpError(provider, response.status);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function scanWikimedia(place) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'geosearch',
    ggsnamespace: '6',
    ggsradius: String(Math.max(Number(env.photoScanWikimediaRadiusM) || 350, 500)),
    ggslimit: String(env.photoScanCandidatesPerProvider || 8),
    ggscoord: place.lat + '|' + place.lng,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200',
    origin: '*'
  });
  const payload = await fetchJson('WIKIMEDIA', WIKIMEDIA_API + '?' + params.toString());
  const pages = Object.values(payload?.query?.pages || {});
  const candidates = [];

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info?.url) continue;
    const metadata = info.extmetadata || {};
    const descriptiveText = [
      page.title,
      metaValue(metadata, 'ObjectName'),
      metaValue(metadata, 'ImageDescription'),
      metaValue(metadata, 'Categories')
    ].filter(Boolean).join(' ');
    const similarity = photoNameSimilarity(place.name, descriptiveText);
    if (similarity < 0.18) continue;

    const licenseCode = metaValue(metadata, 'LicenseShortName') || null;
    const licenseUrl = metaValue(metadata, 'LicenseUrl') || null;
    const author = metaValue(metadata, 'Artist') || null;
    const credit = metaValue(metadata, 'Credit') || null;
    const score = clamp(
      similarity * 0.68 + resolutionScore(info.width, info.height) * 0.15 +
      aspectScore(info.width, info.height) * 0.1 + (licenseCode ? 0.07 : 0),
      0,
      1
    );
    const providerRef = String(page.pageid || page.title);
    candidates.push({
      source: 'WIKIMEDIA',
      providerRef,
      dedupeKey: 'WIKIMEDIA:' + providerRef,
      remoteUrl: info.url,
      previewUrl: info.thumburl || info.url,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(String(page.title || '').replace(/ /g, '_')),
      authorName: author,
      attribution: credit || author || 'Wikimedia Commons',
      licenseCode,
      licenseUrl,
      width: Number(info.width) || null,
      height: Number(info.height) || null,
      classification: 'commons-geosearch',
      score,
      metadata: { title: page.title, similarity }
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, env.photoScanCandidatesPerProvider || 8);
}

function foursquareCoords(item) {
  const lat = Number(item?.latitude ?? item?.geocodes?.main?.latitude ?? item?.geocodes?.main?.lat);
  const lng = Number(item?.longitude ?? item?.geocodes?.main?.longitude ?? item?.geocodes?.main?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function scanFoursquare(place, apiKey, diagnostics) {
  const headers = {
    Authorization: 'Bearer ' + apiKey,
    'X-Places-Api-Version': FOURSQUARE_VERSION
  };
  const params = new URLSearchParams({
    query: place.name,
    ll: place.lat + ',' + place.lng,
    radius: '1200',
    limit: '10',
    sort: 'DISTANCE'
  });
  const search = await fetchJson('FOURSQUARE', FOURSQUARE_API + '/places/search?' + params.toString(), { headers });
  const results = Array.isArray(search?.results) ? search.results : [];
  diagnostics.foursquareSearchResults += results.length;
  let best = null;

  for (const item of results) {
    const coords = foursquareCoords(item);
    if (!coords) continue;
    const similarity = photoNameSimilarity(place.name, item.name);
    const distance = haversineMeters(place.lat, place.lng, coords.lat, coords.lng);
    if (!isFoursquareMatchAcceptable(place.name, item.name, distance)) continue;
    const matchScore = similarity * 0.68 + (1 - Math.min(distance / 1200, 1)) * 0.32;
    if (!best || matchScore > best.matchScore) best = { item, similarity, distance, matchScore };
  }
  if (!best) return [];

  diagnostics.foursquareMatchedPlaces += 1;
  const fsqId = best.item.fsq_place_id || best.item.fsq_id || best.item.id;
  if (!fsqId) return [];
  const photoParams = new URLSearchParams({
    limit: String(env.photoScanCandidatesPerProvider || 8),
    sort: 'POPULAR'
  });
  const photosPayload = await fetchJson(
    'FOURSQUARE',
    FOURSQUARE_API + '/places/' + encodeURIComponent(fsqId) + '/photos?' + photoParams.toString(),
    { headers }
  );
  const photos = Array.isArray(photosPayload) ? photosPayload : (photosPayload?.results || []);
  if (!photos.length) diagnostics.foursquareMatchedWithoutPhotos += 1;
  const candidates = [];

  for (const photo of photos) {
    const classScore = classificationScore(photo.classifications);
    if (classScore < 0) continue;
    const photoId = photo.id || photo.fsq_photo_id;
    if (!photoId || !photo.prefix || !photo.suffix) continue;
    const score = clamp(
      best.similarity * 0.42 +
      (1 - Math.min(best.distance / 1200, 1)) * 0.18 +
      classScore * 0.25 +
      resolutionScore(photo.width, photo.height) * 0.15,
      0,
      1
    );
    const classes = normalizeClassifications(photo.classifications);
    candidates.push({
      source: 'FOURSQUARE',
      providerRef: String(fsqId) + ':' + String(photoId),
      dedupeKey: 'FOURSQUARE:' + String(fsqId) + ':' + String(photoId),
      remoteUrl: photo.prefix + 'original' + photo.suffix,
      previewUrl: photo.prefix + '600x400' + photo.suffix,
      sourcePageUrl: null,
      authorName: null,
      attribution: 'Foursquare Places',
      licenseCode: null,
      licenseUrl: null,
      width: Number(photo.width) || null,
      height: Number(photo.height) || null,
      classification: classes[0] || null,
      score,
      metadata: {
        fsqPlaceId: String(fsqId),
        matchedName: best.item.name || null,
        distanceMeters: Math.round(best.distance),
        nameSimilarity: best.similarity,
        classifications: classes
      }
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, env.photoScanCandidatesPerProvider || 8);
}

async function saveCandidate(placeId, candidate) {
  const { rowCount } = await pool.query(
    `INSERT INTO place_photo_candidates (
       place_id, source, provider_ref, dedupe_key, remote_url, preview_url,
       source_page_url, author_name, attribution, license_code, license_url,
       width, height, classification, score, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (place_id, dedupe_key) DO UPDATE
     SET remote_url = EXCLUDED.remote_url,
         preview_url = EXCLUDED.preview_url,
         source_page_url = EXCLUDED.source_page_url,
         author_name = EXCLUDED.author_name,
         attribution = EXCLUDED.attribution,
         license_code = EXCLUDED.license_code,
         license_url = EXCLUDED.license_url,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         classification = EXCLUDED.classification,
         score = EXCLUDED.score,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
     WHERE place_photo_candidates.status = 'PENDING'`,
    [
      placeId, candidate.source, candidate.providerRef, candidate.dedupeKey,
      candidate.remoteUrl, candidate.previewUrl, candidate.sourcePageUrl,
      candidate.authorName, candidate.attribution, candidate.licenseCode,
      candidate.licenseUrl, candidate.width, candidate.height,
      candidate.classification, candidate.score, candidate.metadata
    ]
  );
  return rowCount > 0;
}

async function getScanTargets(scope, limit) {
  const missingClause = scope === 'ALL'
    ? ''
    : `AND NOT EXISTS (SELECT 1 FROM place_images pi WHERE pi.place_id = p.id)`;
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.address,
            ST_Y(p.location) AS lat, ST_X(p.location) AS lng
     FROM places p
     WHERE p.status = 'PUBLISHED'
       ${missingClause}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng)
  }));
}

async function updateRun(id, fields) {
  const params = [];
  const clauses = [];
  for (const [column, value] of Object.entries(fields)) {
    params.push(value);
    clauses.push(column + ' = $' + params.length);
  }
  params.push(Number(id));
  await pool.query(`UPDATE place_photo_scan_runs SET ${clauses.join(', ')} WHERE id = $${params.length}`, params);
}

function recordProviderError(diagnostics, provider, error) {
  diagnostics.providerErrors += 1;
  const status = Number(error?.status) || null;
  const key = provider + ':' + (status || error?.name || 'ERROR');
  diagnostics.errorCounts[key] = (diagnostics.errorCounts[key] || 0) + 1;
}

function diagnosticsMessage(diagnostics, candidateCount) {
  const parts = [];
  parts.push('Wikimedia: ' + diagnostics.wikimediaCandidates + ' ảnh');
  parts.push('Foursquare: ' + diagnostics.foursquareCandidates + ' ảnh');
  if (diagnostics.foursquareMatchedPlaces) {
    parts.push('FSQ match ' + diagnostics.foursquareMatchedPlaces + ' địa điểm');
  }
  if (diagnostics.foursquareMatchedWithoutPhotos) {
    parts.push(diagnostics.foursquareMatchedWithoutPhotos + ' match không có photos');
  }
  const errors = Object.entries(diagnostics.errorCounts)
    .map(([key, count]) => key.replace(':', ' HTTP ') + ' ×' + count);
  if (errors.length) parts.push('Lỗi: ' + errors.join(', '));
  if (!candidateCount && !errors.length) parts.push('Không có candidate đủ tin cậy');
  return parts.join(' · ').slice(0, 3000);
}

async function executeScan(runId, scope, limit, foursquareKey) {
  const diagnostics = {
    wikimediaCandidates: 0,
    foursquareCandidates: 0,
    foursquareSearchResults: 0,
    foursquareMatchedPlaces: 0,
    foursquareMatchedWithoutPhotos: 0,
    providerErrors: 0,
    errorCounts: {}
  };
  let scannedPlaces = 0;
  let candidateCount = 0;
  let skipped = 0;

  try {
    await updateRun(runId, { status: 'RUNNING', started_at: new Date(), error_message: null });
    const places = await getScanTargets(scope, limit);

    for (const place of places) {
      scannedPlaces += 1;
      const found = [];

      try {
        const wikimedia = await scanWikimedia(place);
        diagnostics.wikimediaCandidates += wikimedia.length;
        found.push(...wikimedia);
      } catch (error) {
        recordProviderError(diagnostics, 'WIKIMEDIA', error);
      }

      if (foursquareKey) {
        try {
          const foursquare = await scanFoursquare(place, foursquareKey, diagnostics);
          diagnostics.foursquareCandidates += foursquare.length;
          found.push(...foursquare);
        } catch (error) {
          recordProviderError(diagnostics, 'FOURSQUARE', error);
        }
      }

      if (!found.length) {
        skipped += 1;
        continue;
      }

      const sorted = found
        .sort((a, b) => b.score - a.score)
        .slice(0, env.photoScanMaxCandidatesPerPlace || 8);
      for (const candidate of sorted) {
        if (await saveCandidate(place.id, candidate)) candidateCount += 1;
      }
    }

    const message = diagnosticsMessage(diagnostics, candidateCount);
    const hardFailure = candidateCount === 0 && diagnostics.providerErrors > 0;
    await updateRun(runId, {
      status: hardFailure ? 'FAILED' : 'SUCCESS',
      scanned_places_count: scannedPlaces,
      candidate_count: candidateCount,
      skipped_count: skipped,
      error_message: message,
      finished_at: new Date()
    });
  } catch (error) {
    await updateRun(runId, {
      status: 'FAILED',
      scanned_places_count: scannedPlaces,
      candidate_count: candidateCount,
      skipped_count: skipped,
      error_message: String(error?.message || error).slice(0, 3000),
      finished_at: new Date()
    });
  }
}

export async function startPhotoScan({ startedBy, scope = 'MISSING_IMAGES', limit = 50 } = {}) {
  const normalizedScope = scope === 'ALL' ? 'ALL' : 'MISSING_IMAGES';
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const foursquare = await resolveIntegrationSecret('FOURSQUARE');
  const providers = ['WIKIMEDIA'];
  if (foursquare.secret) providers.push('FOURSQUARE');

  await pool.query(
    `UPDATE place_photo_scan_runs
     SET status = 'FAILED', finished_at = NOW(),
         error_message = COALESCE(error_message, 'Photo scan was interrupted before completion.')
     WHERE status IN ('QUEUED','RUNNING')
       AND COALESCE(started_at, created_at) < NOW() - INTERVAL '2 hours'`
  );

  const active = await pool.query(
    `SELECT id FROM place_photo_scan_runs
     WHERE status IN ('QUEUED','RUNNING') ORDER BY created_at DESC LIMIT 1`
  );
  if (active.rows[0]) throw new AppError('Đang có một lần quét ảnh chạy.', 409);

  const { rows } = await pool.query(
    `INSERT INTO place_photo_scan_runs (status, scope, requested_limit, providers, started_by)
     VALUES ('QUEUED',$1,$2,$3,$4) RETURNING *`,
    [normalizedScope, safeLimit, JSON.stringify(providers), startedBy || null]
  );
  const row = rows[0];

  setImmediate(() => {
    executeScan(row.id, normalizedScope, safeLimit, foursquare.secret || null)
      .catch((error) => console.error('[Hola Maps] Photo Scanner V2 failed:', error));
  });

  return {
    id: String(row.id),
    status: row.status,
    scope: row.scope,
    requestedLimit: Number(row.requested_limit) || 0,
    providers: Array.isArray(row.providers) ? row.providers : [],
    scannedPlaces: 0,
    candidates: 0,
    skipped: 0,
    startedBy: row.started_by ? String(row.started_by) : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message || null,
    createdAt: row.created_at
  };
}
