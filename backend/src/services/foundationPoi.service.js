import { pool } from '../database/pool.js';
import { approveImportedPlace } from './placeImport.service.js';

const FOUNDATION_POLICY = new Map([
  ['truong-hoc', 0.78],
  ['y-te', 0.80],
  ['co-quan', 0.82],
  ['giao-thong', 0.84],
  ['nhien-lieu-sac', 0.84],
  ['check-in', 0.86],
  ['khu-du-lich', 0.86],
  ['ngan-hang-atm', 0.88],
  ['sieu-thi', 0.88],
  ['cafe', 0.90],
  ['an-uong', 0.90],
  ['homestay', 0.90],
  ['villa', 0.90]
]);

export const FOUNDATION_POI_CATEGORIES = [...FOUNDATION_POLICY.keys()];

export function foundationConfidenceForCategory(slug) {
  return FOUNDATION_POLICY.get(String(slug || '').trim()) ?? null;
}

/**
 * Publish only Overture candidates that are safe enough to become searchable
 * POI anchors immediately. Ambiguous categories, null confidence, temporary
 * closures and duplicates remain in the normal staging queue.
 */
export async function publishFoundationPois({ reviewerId, limit = 800 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 800, 1), 1500);
  const categories = FOUNDATION_POI_CATEGORIES;

  const { rows } = await pool.query(
    `SELECT id, mapped_category_slug, confidence
     FROM imported_places
     WHERE source = 'OVERTURE'
       AND import_status = 'NEW'
       AND duplicate_of_place_id IS NULL
       AND mapped_category_slug = ANY($1::text[])
       AND confidence IS NOT NULL
       AND COALESCE(operating_status, '') <> 'temporarily_closed'
     ORDER BY confidence DESC NULLS LAST, id ASC
     LIMIT $2`,
    [categories, safeLimit]
  );

  const approved = [];
  const skippedByPolicy = [];
  const failed = [];

  for (const row of rows) {
    const threshold = foundationConfidenceForCategory(row.mapped_category_slug);
    const confidence = Number(row.confidence);

    if (!Number.isFinite(confidence) || threshold === null || confidence < threshold) {
      skippedByPolicy.push({
        id: String(row.id),
        category: row.mapped_category_slug,
        confidence: Number.isFinite(confidence) ? confidence : null,
        threshold
      });
      continue;
    }

    try {
      const result = await approveImportedPlace(row.id, reviewerId || null);
      approved.push({
        ...result,
        category: row.mapped_category_slug,
        confidence
      });
    } catch (error) {
      failed.push({ id: String(row.id), error: error.message });
    }
  }

  return {
    considered: rows.length,
    approvedCount: approved.length,
    skippedByPolicyCount: skippedByPolicy.length,
    failedCount: failed.length,
    approved,
    skippedByPolicy,
    failed,
    policy: Object.fromEntries(FOUNDATION_POLICY)
  };
}
