import { pool } from '../database/pool.js';
import { reputationFromRow } from './reputation.service.js';
import { calculateExpertise, expertisePriorityBoost } from './expertise.service.js';

const LIST_SELECT = `
  SELECT
    ct.id, ct.user_id, ct.place_id, ct.type, ct.status, ct.payload,
    ct.reject_reason, ct.reviewed_by, ct.reviewed_at, ct.created_at, ct.updated_at,
    ct.risk_score, ct.risk_flags, ct.fingerprint,
    u.name AS user_name, u.email AS user_email,
    u.trust_score AS user_trust_score,
    u.approved_count AS user_approved_count,
    u.rejected_count AS user_rejected_count,
    u.created_at AS user_created_at,
    COALESCE((
      SELECT SUM(pt.amount)
      FROM points_transactions pt
      WHERE pt.user_id = u.id
        AND pt.contribution_id IS NOT NULL
        AND pt.amount > 0
        AND pt.reason LIKE '%_QUALITY_APPROVED'
    ), 0)::int AS user_quality_points,
    (
      SELECT MAX(rc.reviewed_at)
      FROM contributions rc
      WHERE rc.user_id = u.id
        AND rc.status IN ('APPROVED', 'REJECTED')
    ) AS user_last_reviewed_at,
    COALESCE(rctl.score_adjustment, 0)::int AS user_score_adjustment,
    rctl.permission_ceiling AS user_permission_ceiling,
    rex.expertise_key AS domain_expertise_key,
    rex.label AS domain_expertise_label,
    rex.approved_count AS domain_expertise_approved_count,
    rex.rejected_count AS domain_expertise_rejected_count,
    rex.quality_points AS domain_expertise_quality_points,
    rex.last_reviewed_at AS domain_expertise_last_reviewed_at,
    p.name AS place_name,
    rv.name AS reviewer_name, rv.role AS reviewer_role,
    rv.ctv_level AS reviewer_ctv_level, rv.ctv_trust_score AS reviewer_ctv_trust_score,
    cma.verdict AS ctv_audit_verdict, cma.note AS ctv_audit_note,
    (
      SELECT COUNT(*)::int
      FROM road_status_confirmations rc
      WHERE rc.contribution_id = ct.id AND rc.verdict = 'STILL_ACTIVE'
    ) AS active_confirmations,
    (
      SELECT COUNT(*)::int
      FROM road_status_confirmations rc
      WHERE rc.contribution_id = ct.id AND rc.verdict = 'RESOLVED'
    ) AS resolved_confirmations
  FROM contributions ct
  JOIN users u ON u.id = ct.user_id
  LEFT JOIN reputation_controls rctl
    ON rctl.user_id = u.id
   AND (rctl.expires_at IS NULL OR rctl.expires_at > NOW())
  LEFT JOIN reputation_expertise rex
    ON rex.user_id = u.id
   AND rex.dimension = 'DOMAIN'
   AND rex.expertise_key = CASE
     WHEN ct.type IN ('CREATE_PLACE', 'UPDATE_PLACE', 'REPORT_CLOSED', 'REPORT_WRONG_INFO') THEN 'PLACE_DATA'
     WHEN ct.type = 'ADD_PHOTO' THEN 'MEDIA'
     WHEN ct.type = 'FIX_LOCATION' THEN 'LOCATION'
     WHEN ct.type IN ('UPDATE_HOURS', 'UPDATE_PRICE') THEN 'LOCAL_INFO'
     WHEN ct.type IN ('REPORT_FLOOD', 'REPORT_ROAD_CLOSURE', 'REPORT_ALERT') THEN 'ROAD_SAFETY'
     ELSE 'GENERAL'
   END
  LEFT JOIN places p ON p.id = ct.place_id
  LEFT JOIN users rv ON rv.id = ct.reviewed_by
  LEFT JOIN ctv_moderation_audits cma ON cma.contribution_id = ct.id
`;

function mapRow(row) {
  if (!row) return null;
  const contributorReputation = reputationFromRow({
    quality_points: row.user_quality_points,
    approved_count: row.user_approved_count,
    rejected_count: row.user_rejected_count,
    trust_score: row.user_trust_score,
    created_at: row.user_created_at,
    last_reviewed_at: row.user_last_reviewed_at,
    score_adjustment: row.user_score_adjustment,
    permission_ceiling: row.user_permission_ceiling
  });
  const domainExpertise = row.domain_expertise_key
    ? {
        expertiseKey: row.domain_expertise_key,
        label: row.domain_expertise_label,
        ...calculateExpertise({
          approvedCount: row.domain_expertise_approved_count,
          rejectedCount: row.domain_expertise_rejected_count,
          qualityPoints: row.domain_expertise_quality_points,
          lastReviewedAt: row.domain_expertise_last_reviewed_at
        })
      }
    : null;
  const domainBoost = expertisePriorityBoost({ expertise: domainExpertise, reputation: contributorReputation });
  const basePriority = Number(contributorReputation?.permissions?.moderationPriority || 0);
  const priority = Math.min(4, basePriority + domainBoost);
  const riskScore = Number(row.risk_score || 0);

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    contributorReputation: {
      version: domainBoost > 0 ? '2.3' : contributorReputation.version,
      code: contributorReputation.code,
      name: contributorReputation.name,
      score: contributorReputation.score,
      confidence: contributorReputation.confidence,
      permissions: contributorReputation.permissions,
      domainExpertise: domainExpertise ? {
        key: domainExpertise.expertiseKey,
        label: domainExpertise.label,
        score: domainExpertise.score,
        tier: domainExpertise.tier
      } : null,
      expertisePriorityBoost: domainBoost,
      effectiveModerationPriority: priority
    },
    reviewLane: riskScore >= 70
      ? 'RISK_REVIEW'
      : priority >= 3
        ? 'FAST_TRACK_REVIEW'
        : priority >= 2
          ? 'PRIORITY_REVIEW'
          : 'STANDARD_REVIEW',
    placeId: row.place_id,
    placeName: row.place_name,
    type: row.type,
    status: row.status,
    payload: row.payload,
    moderation: row.payload?.moderation || null,
    rejectReason: row.reject_reason,
    reviewedBy: row.reviewed_by,
    reviewerName: row.reviewer_name || null,
    reviewerRole: row.reviewer_role || null,
    reviewerCtvLevel: row.reviewer_ctv_level ? Number(row.reviewer_ctv_level) : null,
    reviewerCtvTrustScore: row.reviewer_ctv_trust_score !== null && row.reviewer_ctv_trust_score !== undefined
      ? Number(row.reviewer_ctv_trust_score)
      : null,
    ctvAuditVerdict: row.ctv_audit_verdict || null,
    ctvAuditNote: row.ctv_audit_note || null,
    riskScore,
    riskFlags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeConfirmations: Number(row.active_confirmations || 0),
    resolvedConfirmations: Number(row.resolved_confirmations || 0)
  };
}

function comparePendingContributions(a, b) {
  const aCriticalRisk = Number(a.riskScore || 0) >= 70 ? 1 : 0;
  const bCriticalRisk = Number(b.riskScore || 0) >= 70 ? 1 : 0;
  if (aCriticalRisk !== bCriticalRisk) return bCriticalRisk - aCriticalRisk;

  const aPriority = Number(a.contributorReputation?.effectiveModerationPriority || 0);
  const bPriority = Number(b.contributorReputation?.effectiveModerationPriority || 0);
  if (aPriority !== bPriority) return bPriority - aPriority;

  if (Number(a.riskScore || 0) !== Number(b.riskScore || 0)) {
    return Number(b.riskScore || 0) - Number(a.riskScore || 0);
  }

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export async function createContribution({
  userId,
  placeId,
  type,
  payload,
  riskScore = 0,
  riskFlags = [],
  fingerprint = null
}, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO contributions (
       user_id, place_id, type, payload, risk_score, risk_flags, fingerprint
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [
      userId,
      placeId || null,
      type,
      JSON.stringify(payload || {}),
      Math.max(0, Math.min(100, Number(riskScore) || 0)),
      JSON.stringify(riskFlags || []),
      fingerprint || null
    ]
  );
  return rows[0].id;
}

export async function getContributionById(id, client = pool) {
  const { rows } = await client.query(`${LIST_SELECT} WHERE ct.id = $1`, [id]);
  return mapRow(rows[0]);
}

export async function getContributionForUpdate(id, client) {
  const { rows } = await client.query('SELECT * FROM contributions WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] || null;
}

export async function listContributionsByUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `${LIST_SELECT} WHERE ct.user_id = $1 ORDER BY ct.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows.map(mapRow);
}

export async function listContributions({ status, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  if (status === 'PENDING') {
    const candidateLimit = Math.min(Math.max((safeLimit + safeOffset) * 4, 100), 500);
    const { rows } = await pool.query(
      `${LIST_SELECT}
       WHERE ct.status = $1
       ORDER BY ct.created_at ASC
       LIMIT $2`,
      ['PENDING', candidateLimit]
    );

    return rows
      .map(mapRow)
      .sort(comparePendingContributions)
      .slice(safeOffset, safeOffset + safeLimit);
  }

  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE ct.status = $${params.length}`;
  }
  params.push(safeLimit, safeOffset);
  const { rows } = await pool.query(
    `${LIST_SELECT} ${where} ORDER BY ct.risk_score DESC, ct.created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows.map(mapRow);
}

export async function markContributionReviewed(
  id,
  { status, reviewedBy, rejectReason, placeId, moderation },
  client
) {
  await client.query(
    `UPDATE contributions
     SET status = $1,
         reviewed_by = $2,
         reviewed_at = NOW(),
         reject_reason = $3,
         place_id = COALESCE($4, place_id),
         payload = CASE
           WHEN $5::jsonb IS NULL THEN payload
           ELSE jsonb_set(COALESCE(payload, '{}'::jsonb), '{moderation}', $5::jsonb, TRUE)
         END,
         updated_at = NOW()
     WHERE id = $6`,
    [
      status,
      reviewedBy,
      rejectReason || null,
      placeId || null,
      moderation ? JSON.stringify(moderation) : null,
      id
    ]
  );
}

export async function recordChange(contributionId, field, oldValue, newValue, client) {
  await client.query(
    `INSERT INTO contribution_changes (contribution_id, field, old_value, new_value)
     VALUES ($1, $2, $3, $4)`,
    [
      contributionId,
      field,
      oldValue === undefined || oldValue === null ? null : String(oldValue),
      newValue === undefined || newValue === null ? null : String(newValue)
    ]
  );
}
