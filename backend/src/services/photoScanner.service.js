import { pool, withTransaction } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const STALE_RUN_HOURS = 2;
const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const FOURSQUARE_API = 'https://places-api.foursquare.com';
const FOURSQUARE_VERSION = '2025-06-17';

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

export function normalizePhotoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/file:/g, ' ')
    .replace(/\.(jpe?g|png|webp|gif|tiff?)$/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(value) {
  return new Set(normalizePhotoText(value).split(/\s+/).filter((token) => token.length > 1));
}

export function photoNameSimilarity(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return (2 * intersection) / (left.size + right.size);
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

export function foursquareClassificationScore(value) {
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

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.photoScanRequestTimeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HolaMaps-PhotoScanner/1.0',
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      throw new Error('Photo provider returned HTTP ' + response.status);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function mapCandidate(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    placeName: row.place_name || null,
    placeAddress: row.place_address || null,
    source: row.source,
    providerRef: row.provider_ref,
    remoteUrl: row.remote_url,
    previewUrl: row.preview_url || row.remote_url,
    sourcePageUrl: row.source_page_url || null,
    authorName: row.author_name || null,
    attribution: row.attribution || null,
    licenseCode: row.license_code || null,
    licenseUrl: row.license_url || null,
    width: Number(row.width) || null,
    height: Number(row.height) || null,
    classification: row.classification || null,
    score: Number(row.score) || 0,
    status: row.status,
    metadata: row.metadata || {},
    approvedImageId: row.approved_image_id ? String(row.approved_image_id) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRun(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    status: row.status,
    scope: row.scope,
    requestedLimit: Number(row.requested_limit) || 0,
    providers: Array.isArray(row.providers) ? row.providers : [],
    scannedPlaces: Number(row.scanned_places_count) || 0,
    candidates: Number(row.candidate_count) || 0,
    skipped: Number(row.skipped_count) || 0,
    startedBy: row.started_by ? String(row.started_by) : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message || null,
    createdAt: row.created_at
  };
}

async function scanWikimedia(place) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'geosearch',
    ggsnamespace: '6',
    ggsradius: String(env.photoScanWikimediaRadiusM),
    ggslimit: String(env.photoScanCandidatesPerProvider),
    ggscoord: place.lat + '|' + place.lng,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200',
    origin: '*'
  });
  const payload = await fetchJson(WIKIMEDIA_API + '?' + params.toString());
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
    if (similarity < 0.24) continue;

    const licenseCode = metaValue(metadata, 'LicenseShortName') || null;
    const licenseUrl = metaValue(metadata, 'LicenseUrl') || null;
    const author = metaValue(metadata, 'Artist') || null;
    const credit = metaValue(metadata, 'Credit') || null;
    const score = clamp(
      similarity * 0.68 +
      resolutionScore(info.width, info.height) * 0.15 +
      aspectScore(info.width, info.height) * 0.1 +
      (licenseCode ? 0.07 : 0),
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
  return candidates.sort((a, b) => b.score - a.score).slice(0, env.photoScanCandidatesPerProvider);
}

function foursquareCoords(item) {
  const lat = Number(item?.latitude ?? item?.geocodes?.main?.latitude ?? item?.geocodes?.main?.lat);
  const lng = Number(item?.longitude ?? item?.geocodes?.main?.longitude ?? item?.geocodes?.main?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function scanFoursquare(place) {
  if (!env.foursquareApiKey) return [];
  const headers = {
    Authorization: 'Bearer ' + env.foursquareApiKey,
    'X-Places-Api-Version': FOURSQUARE_VERSION
  };
  const params = new URLSearchParams({
    query: place.name,
    ll: place.lat + ',' + place.lng,
    radius: '700',
    limit: '5'
  });
  const search = await fetchJson(FOURSQUARE_API + '/places/search?' + params.toString(), { headers });
  const results = Array.isArray(search?.results) ? search.results : [];
  let best = null;

  for (const item of results) {
    const coords = foursquareCoords(item);
    if (!coords) continue;
    const similarity = photoNameSimilarity(place.name, item.name);
    const distance = haversineMeters(place.lat, place.lng, coords.lat, coords.lng);
    if (distance > 500 || similarity < 0.38) continue;
    const matchScore = similarity * 0.72 + (1 - Math.min(distance / 500, 1)) * 0.28;
    if (!best || matchScore > best.matchScore) {
      best = { item, similarity, distance, matchScore };
    }
  }
  if (!best) return [];

  const fsqId = best.item.fsq_place_id || best.item.fsq_id || best.item.id;
  if (!fsqId) return [];
  const photoParams = new URLSearchParams({ limit: String(env.photoScanCandidatesPerProvider), sort: 'POPULAR' });
  const photosPayload = await fetchJson(
    FOURSQUARE_API + '/places/' + encodeURIComponent(fsqId) + '/photos?' + photoParams.toString(),
    { headers }
  );
  const photos = Array.isArray(photosPayload) ? photosPayload : (photosPayload?.results || []);
  const candidates = [];

  for (const photo of photos) {
    const classScore = foursquareClassificationScore(photo.classifications);
    if (classScore < 0) continue;
    const photoId = photo.id || photo.fsq_photo_id;
    if (!photoId || !photo.prefix || !photo.suffix) continue;
    const score = clamp(
      best.similarity * 0.42 +
      (1 - Math.min(best.distance / 500, 1)) * 0.18 +
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
  return candidates.sort((a, b) => b.score - a.score).slice(0, env.photoScanCandidatesPerProvider);
}

async function saveCandidate(placeId, candidate) {
  const { rowCount } = await pool.query(
    `INSERT INTO place_photo_candidates (
       place_id, source, provider_ref, dedupe_key, remote_url, preview_url,
       source_page_url, author_name, attribution, license_code, license_url,
       width, height, classification, score, metadata
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
     )
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

async function expireStaleRuns() {
  await pool.query(
    `UPDATE place_photo_scan_runs
     SET status = 'FAILED', finished_at = NOW(),
         error_message = COALESCE(error_message, 'Photo scan was interrupted before completion.')
     WHERE status IN ('QUEUED','RUNNING')
       AND COALESCE(started_at, created_at) < NOW() - ($1::text || ' hours')::interval`,
    [String(STALE_RUN_HOURS)]
  );
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
  const mapping = {
    status: 'status',
    scannedPlaces: 'scanned_places_count',
    candidates: 'candidate_count',
    skipped: 'skipped_count',
    errorMessage: 'error_message'
  };
  const clauses = [];
  const params = [];
  for (const [key, column] of Object.entries(mapping)) {
    if (fields[key] === undefined) continue;
    params.push(fields[key]);
    clauses.push(column + ' = $' + params.length);
  }
  if (fields.startedAtNow) clauses.push('started_at = NOW()');
  if (fields.finishedAtNow) clauses.push('finished_at = NOW()');
  params.push(Number(id));
  await pool.query(
    `UPDATE place_photo_scan_runs SET ${clauses.join(', ')} WHERE id = $${params.length}`,
    params
  );
}

async function executeScan(runId, scope, limit, providers) {
  let scannedPlaces = 0;
  let candidateCount = 0;
  let skipped = 0;
  try {
    await updateRun(runId, { status: 'RUNNING', startedAtNow: true, errorMessage: null });
    const places = await getScanTargets(scope, limit);
    for (const place of places) {
      scannedPlaces += 1;
      let found = [];
      try {
        if (providers.includes('WIKIMEDIA')) {
          found.push(...await scanWikimedia(place));
        }
        if (providers.includes('FOURSQUARE') && env.foursquareApiKey) {
          found.push(...await scanFoursquare(place));
        }
      } catch (error) {
        console.warn('[Hola Maps] photo provider failed for place', place.id, error?.message || error);
      }
      if (!found.length) {
        skipped += 1;
        continue;
      }
      const sorted = found.sort((a, b) => b.score - a.score).slice(0, env.photoScanMaxCandidatesPerPlace);
      for (const candidate of sorted) {
        if (await saveCandidate(place.id, candidate)) candidateCount += 1;
      }
    }
    await updateRun(runId, {
      status: 'SUCCESS', scannedPlaces, candidates: candidateCount, skipped, finishedAtNow: true
    });
  } catch (error) {
    await updateRun(runId, {
      status: 'FAILED', scannedPlaces, candidates: candidateCount, skipped,
      errorMessage: String(error?.message || error).slice(0, 3000), finishedAtNow: true
    });
  }
}

export async function startPhotoScan({ startedBy, scope = 'MISSING_IMAGES', limit = 50 } = {}) {
  await expireStaleRuns();
  const normalizedScope = scope === 'ALL' ? 'ALL' : 'MISSING_IMAGES';
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const providers = ['WIKIMEDIA'];
  if (env.foursquareApiKey) providers.push('FOURSQUARE');

  const active = await pool.query(
    `SELECT * FROM place_photo_scan_runs
     WHERE status IN ('QUEUED','RUNNING') ORDER BY created_at DESC LIMIT 1`
  );
  if (active.rows[0]) {
    throw new AppError('Đang có một lần quét ảnh chạy.', 409, { run: mapRun(active.rows[0]) });
  }

  let row;
  try {
    const result = await pool.query(
      `INSERT INTO place_photo_scan_runs (status, scope, requested_limit, providers, started_by)
       VALUES ('QUEUED',$1,$2,$3,$4) RETURNING *`,
      [normalizedScope, safeLimit, JSON.stringify(providers), startedBy || null]
    );
    row = result.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new AppError('Đang có một lần quét ảnh chạy.', 409);
    throw error;
  }

  setImmediate(() => {
    executeScan(row.id, normalizedScope, safeLimit, providers).catch((error) => {
      console.error('[Hola Maps] background photo scan failed:', error);
    });
  });
  return mapRun(row);
}

export async function listPhotoScanRuns({ limit = 12 } = {}) {
  await expireStaleRuns();
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const { rows } = await pool.query(
    `SELECT * FROM place_photo_scan_runs ORDER BY created_at DESC LIMIT $1`, [safeLimit]
  );
  return rows.map(mapRun);
}

export async function listPhotoCandidates({ status = 'PENDING', source, q, limit = 60, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (status && status !== 'ALL') {
    params.push(String(status).toUpperCase());
    where.push('c.status = $' + params.length);
  }
  if (source && source !== 'ALL') {
    params.push(String(source).toUpperCase());
    where.push('c.source = $' + params.length);
  }
  if (q) {
    params.push('%' + String(q).trim() + '%');
    where.push(`(p.name ILIKE $${params.length} OR p.address ILIKE $${params.length})`);
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  params.push(safeLimit, safeOffset);
  const { rows } = await pool.query(
    `SELECT c.*, p.name AS place_name, p.address AS place_address
     FROM place_photo_candidates c
     JOIN places p ON p.id = c.place_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE c.status WHEN 'PENDING' THEN 0 ELSE 1 END, c.score DESC, c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows.map(mapCandidate);
}

export async function getPhotoScannerStats() {
  const { rows } = await pool.query(
    `SELECT status, source, COUNT(*)::int AS count
     FROM place_photo_candidates GROUP BY status, source`
  );
  const status = { PENDING: 0, APPROVED: 0, REJECTED: 0, STALE: 0 };
  const source = { WIKIMEDIA: 0, FOURSQUARE: 0, GOOGLE: 0 };
  for (const row of rows) {
    status[row.status] = (status[row.status] || 0) + Number(row.count || 0);
    source[row.source] = (source[row.source] || 0) + Number(row.count || 0);
  }
  return {
    status,
    source,
    providers: {
      WIKIMEDIA: { enabled: true, mode: 'REMOTE_WITH_LICENSE' },
      FOURSQUARE: { enabled: Boolean(env.foursquareApiKey), mode: 'REMOTE_REFERENCE' },
      GOOGLE: { enabled: false, mode: 'TRANSIENT_ONLY', reason: 'Không lưu photo name/URL dài hạn trong Photo Scanner V1.' }
    }
  };
}

export async function approvePhotoCandidate(id, reviewerId, { makeCover = true } = {}) {
  return withTransaction(async (client) => {
    const locked = await client.query(
      `SELECT c.*, p.status AS place_status
       FROM place_photo_candidates c JOIN places p ON p.id = c.place_id
       WHERE c.id = $1 FOR UPDATE`, [Number(id)]
    );
    const candidate = locked.rows[0];
    if (!candidate) throw new AppError('Không tìm thấy ảnh quét.', 404);
    if (candidate.status === 'APPROVED') {
      return { alreadyApproved: true, candidate: mapCandidate(candidate), imageId: candidate.approved_image_id ? String(candidate.approved_image_id) : null };
    }
    if (candidate.status !== 'PENDING') throw new AppError('Ảnh này không còn ở trạng thái chờ duyệt.', 409);

    let shouldCover = Boolean(makeCover);
    if (shouldCover) {
      await client.query('UPDATE place_images SET is_cover = FALSE WHERE place_id = $1 AND is_cover = TRUE', [candidate.place_id]);
    } else {
      const cover = await client.query('SELECT 1 FROM place_images WHERE place_id = $1 AND is_cover = TRUE LIMIT 1', [candidate.place_id]);
      if (!cover.rowCount) shouldCover = true;
    }

    const imageResult = await client.query(
      `INSERT INTO place_images (
         place_id, url, thumbnail_url, card_url, is_cover, uploaded_by,
         source, source_photo_id, source_page_url, author_name, attribution,
         license_code, license_url, storage_mode, photo_candidate_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'REMOTE',$14)
       RETURNING id`,
      [
        candidate.place_id, candidate.remote_url,
        candidate.preview_url || candidate.remote_url,
        candidate.preview_url || candidate.remote_url,
        shouldCover, reviewerId || null, candidate.source, candidate.provider_ref,
        candidate.source_page_url, candidate.author_name, candidate.attribution,
        candidate.license_code, candidate.license_url, candidate.id
      ]
    );
    const imageId = imageResult.rows[0].id;
    const updated = await client.query(
      `UPDATE place_photo_candidates
       SET status = 'APPROVED', reviewed_by = $2, reviewed_at = NOW(),
           approved_image_id = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [candidate.id, reviewerId || null, imageId]
    );
    return { alreadyApproved: false, imageId: String(imageId), isCover: shouldCover, candidate: mapCandidate(updated.rows[0]) };
  });
}

export async function rejectPhotoCandidate(id, reviewerId) {
  const { rows } = await pool.query(
    `UPDATE place_photo_candidates
     SET status = 'REJECTED', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *`,
    [Number(id), reviewerId || null]
  );
  if (!rows[0]) throw new AppError('Không tìm thấy ảnh chờ duyệt hoặc ảnh đã được xử lý.', 404);
  return mapCandidate(rows[0]);
}
