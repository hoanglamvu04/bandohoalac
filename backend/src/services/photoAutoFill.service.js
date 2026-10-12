import { pool } from '../database/pool.js';
import { approvePhotoCandidate } from './photoScannerV3.service.js';

const DEFAULT_LIMIT = 250;
const POLL_INTERVAL_MS = 4500;
const MAX_WAIT_MS = 45 * 60 * 1000;

const SAFE_FOURSQUARE_CLASSES = new Set([
  'outdoor_or_storefront',
  'outdoor_building_exterior',
  'outdoor_building_and_grounds',
  'monuments_and_landmark_buildings'
]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function classifications(candidate) {
  const metadata = candidate?.metadata && typeof candidate.metadata === 'object'
    ? candidate.metadata
    : {};
  const values = Array.isArray(metadata.classifications)
    ? metadata.classifications
    : [candidate?.classification].filter(Boolean);
  return values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
}

export function isTrustedPhotoCandidate(candidate) {
  if (!candidate || candidate.status !== 'PENDING') return false;

  const score = number(candidate.score);
  const metadata = candidate.metadata && typeof candidate.metadata === 'object'
    ? candidate.metadata
    : {};

  if (candidate.source === 'FOURSQUARE') {
    const similarity = number(metadata.nameSimilarity);
    const distance = number(metadata.distanceMeters, Number.POSITIVE_INFINITY);
    const classes = classifications(candidate);
    const hasSafeClass = classes.some((value) => SAFE_FOURSQUARE_CLASSES.has(value));

    return score >= 0.82 &&
      similarity >= 0.72 &&
      distance <= 120 &&
      hasSafeClass;
  }

  if (candidate.source === 'WIKIMEDIA') {
    const similarity = number(metadata.similarity);
    return score >= 0.88 &&
      similarity >= 0.62 &&
      Boolean(String(candidate.license_code || '').trim());
  }

  return false;
}

async function trustedPendingCandidates(limit = DEFAULT_LIMIT) {
  const safeLimit = Math.min(Math.max(number(limit, DEFAULT_LIMIT), 1), 500);
  const { rows } = await pool.query(
    `SELECT c.*
     FROM place_photo_candidates c
     JOIN places p ON p.id = c.place_id
     WHERE c.status = 'PENDING'
       AND p.status = 'PUBLISHED'
       AND NOT EXISTS (
         SELECT 1 FROM place_images pi WHERE pi.place_id = c.place_id
       )
     ORDER BY c.place_id ASC, c.score DESC, c.created_at ASC
     LIMIT $1`,
    [safeLimit]
  );

  const bestByPlace = new Map();
  for (const row of rows) {
    if (!isTrustedPhotoCandidate(row)) continue;
    const key = String(row.place_id);
    const current = bestByPlace.get(key);
    if (!current || number(row.score) > number(current.score)) {
      bestByPlace.set(key, row);
    }
  }

  return [...bestByPlace.values()];
}

export async function autoFillTrustedPlacePhotos({ reviewerId, limit = DEFAULT_LIMIT } = {}) {
  const candidates = await trustedPendingCandidates(limit);
  const result = {
    considered: candidates.length,
    approved: 0,
    skipped: 0,
    failures: 0,
    placeIds: []
  };

  for (const candidate of candidates) {
    try {
      const hasImage = await pool.query(
        'SELECT 1 FROM place_images WHERE place_id = $1 LIMIT 1',
        [candidate.place_id]
      );
      if (hasImage.rowCount) {
        result.skipped += 1;
        continue;
      }

      await approvePhotoCandidate(candidate.id, reviewerId || null, { makeCover: true });
      result.approved += 1;
      result.placeIds.push(String(candidate.place_id));
    } catch (error) {
      // Another reviewer/worker may have handled the candidate in the meantime.
      if (error?.statusCode === 404 || error?.statusCode === 409 || error?.status === 404 || error?.status === 409) {
        result.skipped += 1;
      } else {
        result.failures += 1;
        console.warn('[Hola Maps] trusted photo auto-fill failed:', candidate.id, error?.message || error);
      }
    }
  }

  return result;
}

async function readRun(runId) {
  const { rows } = await pool.query(
    'SELECT id, status FROM place_photo_scan_runs WHERE id = $1 LIMIT 1',
    [Number(runId)]
  );
  return rows[0] || null;
}

export function scheduleTrustedPhotoAutoFill({ runId, reviewerId } = {}) {
  if (!runId) return;
  const startedAt = Date.now();

  const tick = async () => {
    try {
      const run = await readRun(runId);
      if (!run) return;

      if (run.status === 'SUCCESS') {
        const result = await autoFillTrustedPlacePhotos({ reviewerId });
        console.info(
          '[Hola Maps] trusted photo auto-fill completed:',
          'run=' + runId,
          'approved=' + result.approved,
          'skipped=' + result.skipped,
          'failures=' + result.failures
        );
        return;
      }

      if (run.status === 'FAILED') return;
      if (Date.now() - startedAt >= MAX_WAIT_MS) return;

      const timer = setTimeout(tick, POLL_INTERVAL_MS);
      timer.unref?.();
    } catch (error) {
      console.warn('[Hola Maps] trusted photo auto-fill watcher failed:', error?.message || error);
      if (Date.now() - startedAt < MAX_WAIT_MS) {
        const timer = setTimeout(tick, POLL_INTERVAL_MS * 2);
        timer.unref?.();
      }
    }
  };

  const timer = setTimeout(tick, 2500);
  timer.unref?.();
}
