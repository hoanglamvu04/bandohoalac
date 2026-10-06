import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { getUserReputation } from './reputation.service.js';
import { contributionDomain, getDomainExpertise } from './expertise.service.js';

const HIGH_IMPACT_TYPES = new Set([
  'CREATE_PLACE',
  'FIX_LOCATION',
  'REPORT_CLOSED',
  'REPORT_FLOOD',
  'REPORT_ROAD_CLOSURE',
  'REPORT_ALERT'
]);

const REPUTATION_WEIGHTS = {
  NEW_MEMBER: 0.6,
  EXPLORER: 0.8,
  CONTRIBUTOR: 1,
  TRUSTED_CONTRIBUTOR: 1.2,
  LOCAL_EXPERT: 1.35
};

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export function minimumCommunityVoters(contributionType) {
  return HIGH_IMPACT_TYPES.has(contributionType) ? 4 : 3;
}

export function calculateVerifierWeight({
  reputation,
  expertise,
  verificationStats
} = {}) {
  let weight = REPUTATION_WEIGHTS[reputation?.code] ?? 0.5;
  const confidence = Number(reputation?.confidence?.score || 0);

  if (expertise?.tier === 'SPECIALIST') weight += 0.15;
  if (expertise?.tier === 'EXPERT') weight += 0.3;

  if (confidence < 40) weight -= 0.15;
  else if (confidence >= 70) weight += 0.1;

  const reviewed = Number(verificationStats?.reviewedCount || 0);
  const accuracy = verificationStats?.accuracy == null
    ? null
    : Number(verificationStats.accuracy);
  if (reviewed >= 5 && accuracy != null) {
    if (accuracy >= 0.8) weight += 0.1;
    else if (accuracy < 0.5) weight -= 0.25;
  }

  return round(Math.max(0.5, Math.min(1.75, weight)), 2);
}

export function calculateCommunityConsensus(votes = [], { requiredVoters = 3 } = {}) {
  const normalized = Array.isArray(votes) ? votes : [];
  const counts = { CONFIRM: 0, DISPUTE: 0, UNSURE: 0 };
  const weights = { CONFIRM: 0, DISPUTE: 0, UNSURE: 0 };

  for (const vote of normalized) {
    const verdict = String(vote?.verdict || '').toUpperCase();
    if (!(verdict in counts)) continue;
    const weight = Math.max(0, Number(vote?.weight) || 0);
    counts[verdict] += 1;
    weights[verdict] += weight;
  }

  const decisiveCount = counts.CONFIRM + counts.DISPUTE;
  const decisiveWeight = weights.CONFIRM + weights.DISPUTE;
  const confirmRatio = decisiveWeight > 0 ? weights.CONFIRM / decisiveWeight : null;
  const disputeRatio = decisiveWeight > 0 ? weights.DISPUTE / decisiveWeight : null;
  const agreementRatio = decisiveWeight > 0
    ? Math.max(weights.CONFIRM, weights.DISPUTE) / decisiveWeight
    : null;

  const volumeMaturity = Math.min(decisiveCount / Math.max(requiredVoters + 1, 4), 1);
  const confidence = agreementRatio == null
    ? 0
    : Math.round(Math.min(100, agreementRatio * 70 + volumeMaturity * 30));

  let state = 'COLLECTING';
  if (decisiveCount >= requiredVoters) {
    const minimumWeightedEvidence = requiredVoters * 0.7;
    if (
      counts.DISPUTE >= 2 &&
      weights.DISPUTE >= Math.max(1.5, minimumWeightedEvidence * 0.65) &&
      (disputeRatio || 0) >= 0.55
    ) {
      state = 'DISPUTED';
    } else if (
      counts.CONFIRM >= requiredVoters &&
      weights.CONFIRM >= minimumWeightedEvidence &&
      (confirmRatio || 0) >= 0.72
    ) {
      state = 'CONFIRMED';
    } else if (
      decisiveCount >= requiredVoters + 1 &&
      (agreementRatio || 0) < 0.72
    ) {
      state = 'SPLIT';
    }
  }

  return {
    state,
    requiredVoters,
    confirmCount: counts.CONFIRM,
    disputeCount: counts.DISPUTE,
    unsureCount: counts.UNSURE,
    confirmWeight: round(weights.CONFIRM),
    disputeWeight: round(weights.DISPUTE),
    unsureWeight: round(weights.UNSURE),
    decisiveCount,
    decisiveWeight: round(decisiveWeight),
    agreementRatio: agreementRatio == null ? null : round(agreementRatio, 4),
    confirmRatio: confirmRatio == null ? null : round(confirmRatio, 4),
    disputeRatio: disputeRatio == null ? null : round(disputeRatio, 4),
    confidence
  };
}

function mapVote(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    contributionId: String(row.contribution_id),
    userId: String(row.user_id),
    verdict: row.verdict,
    weight: Number(row.weight || 0),
    reputationScore: Number(row.reputation_score || 0),
    reputationCode: row.reputation_code || null,
    confidenceScore: Number(row.confidence_score || 0),
    expertiseKey: row.expertise_key || null,
    expertiseTier: row.expertise_tier || null,
    reason: row.reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapState(row, contributionType = null) {
  if (!row) {
    return {
      state: 'COLLECTING',
      requiredVoters: minimumCommunityVoters(contributionType),
      confirmCount: 0,
      disputeCount: 0,
      unsureCount: 0,
      confirmWeight: 0,
      disputeWeight: 0,
      unsureWeight: 0,
      agreementRatio: null,
      confidence: 0,
      updatedAt: null
    };
  }

  return {
    state: row.state,
    requiredVoters: Number(row.required_voters || minimumCommunityVoters(contributionType)),
    confirmCount: Number(row.confirm_count || 0),
    disputeCount: Number(row.dispute_count || 0),
    unsureCount: Number(row.unsure_count || 0),
    confirmWeight: Number(row.confirm_weight || 0),
    disputeWeight: Number(row.dispute_weight || 0),
    unsureWeight: Number(row.unsure_weight || 0),
    agreementRatio: row.agreement_ratio == null ? null : Number(row.agreement_ratio),
    confidence: Number(row.confidence || 0),
    updatedAt: row.updated_at || null
  };
}

export async function getVerifierReliability(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       COUNT(*)::int AS reviewed_count,
       COUNT(*) FILTER (
         WHERE (cv.verdict = 'CONFIRM' AND c.status = 'APPROVED')
            OR (cv.verdict = 'DISPUTE' AND c.status = 'REJECTED')
       )::int AS correct_count,
       MAX(c.reviewed_at) AS last_resolved_at
     FROM community_verifications cv
     JOIN contributions c ON c.id = cv.contribution_id
     WHERE cv.user_id = $1
       AND cv.verdict IN ('CONFIRM', 'DISPUTE')
       AND c.status IN ('APPROVED', 'REJECTED')`,
    [userId]
  );
  const row = rows[0] || {};
  const reviewedCount = Number(row.reviewed_count || 0);
  const correctCount = Number(row.correct_count || 0);
  return {
    reviewedCount,
    correctCount,
    accuracy: reviewedCount > 0 ? round(correctCount / reviewedCount, 4) : null,
    lastResolvedAt: row.last_resolved_at || null
  };
}

async function recalculateState(contributionId, contributionType, client) {
  const { rows } = await client.query(
    `SELECT verdict, weight
     FROM community_verifications
     WHERE contribution_id = $1`,
    [contributionId]
  );
  const consensus = calculateCommunityConsensus(rows, {
    requiredVoters: minimumCommunityVoters(contributionType)
  });

  const result = await client.query(
    `INSERT INTO community_verification_states (
       contribution_id, state, required_voters,
       confirm_count, dispute_count, unsure_count,
       confirm_weight, dispute_weight, unsure_weight,
       agreement_ratio, confidence, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (contribution_id)
     DO UPDATE SET
       state = EXCLUDED.state,
       required_voters = EXCLUDED.required_voters,
       confirm_count = EXCLUDED.confirm_count,
       dispute_count = EXCLUDED.dispute_count,
       unsure_count = EXCLUDED.unsure_count,
       confirm_weight = EXCLUDED.confirm_weight,
       dispute_weight = EXCLUDED.dispute_weight,
       unsure_weight = EXCLUDED.unsure_weight,
       agreement_ratio = EXCLUDED.agreement_ratio,
       confidence = EXCLUDED.confidence,
       updated_at = NOW()
     RETURNING *`,
    [
      contributionId,
      consensus.state,
      consensus.requiredVoters,
      consensus.confirmCount,
      consensus.disputeCount,
      consensus.unsureCount,
      consensus.confirmWeight,
      consensus.disputeWeight,
      consensus.unsureWeight,
      consensus.agreementRatio,
      consensus.confidence
    ]
  );

  return mapState(result.rows[0], contributionType);
}

export async function getCommunityVerificationSummary(contributionId, {
  userId = null,
  contributionType = null
} = {}, client = pool) {
  let type = contributionType;
  if (!type) {
    const contributionResult = await client.query(
      'SELECT type FROM contributions WHERE id = $1',
      [contributionId]
    );
    type = contributionResult.rows[0]?.type || null;
  }

  const [stateResult, voteResult] = await Promise.all([
    client.query(
      'SELECT * FROM community_verification_states WHERE contribution_id = $1',
      [contributionId]
    ),
    userId
      ? client.query(
          `SELECT * FROM community_verifications
           WHERE contribution_id = $1 AND user_id = $2`,
          [contributionId, userId]
        )
      : Promise.resolve({ rows: [] })
  ]);

  return {
    ...mapState(stateResult.rows[0], type),
    myVote: mapVote(voteResult.rows[0])
  };
}

export async function submitCommunityVerification({
  contributionId,
  userId,
  verdict,
  reason = null
}) {
  return withTransaction(async (client) => {
    const contributionResult = await client.query(
      `SELECT id, user_id, type, status, risk_score
       FROM contributions
       WHERE id = $1
       FOR UPDATE`,
      [contributionId]
    );
    const contribution = contributionResult.rows[0];
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') {
      throw new AppError('Đóng góp này đã được xử lý nên không còn nhận xác minh cộng đồng.', 409);
    }
    if (Number(contribution.user_id) === Number(userId)) {
      throw new AppError('Bạn không thể tự xác minh đóng góp của chính mình.', 403);
    }
    if (Number(contribution.risk_score || 0) >= 70) {
      throw new AppError('Đóng góp có tín hiệu rủi ro cao đang được chuyển cho đội kiểm duyệt.', 403);
    }

    const normalizedVerdict = String(verdict || '').toUpperCase();
    if (!['CONFIRM', 'DISPUTE', 'UNSURE'].includes(normalizedVerdict)) {
      throw new AppError('Verdict không hợp lệ.', 400);
    }
    const normalizedReason = String(reason || '').trim().slice(0, 500) || null;
    if (normalizedVerdict === 'DISPUTE' && !normalizedReason) {
      throw new AppError('Vui lòng nêu lý do khi phản đối một đóng góp.', 400);
    }

    const reputation = await getUserReputation(userId, client);
    if (!reputation) throw new AppError('User not found.', 404);
    const expertise = await getDomainExpertise(userId, contribution.type, client);
    const verificationStats = await getVerifierReliability(userId, client);
    const weight = calculateVerifierWeight({ reputation, expertise, verificationStats });

    const voteResult = await client.query(
      `INSERT INTO community_verifications (
         contribution_id, user_id, verdict, weight,
         reputation_score, reputation_code, confidence_score,
         expertise_key, expertise_tier, reason, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (contribution_id, user_id)
       DO UPDATE SET
         verdict = EXCLUDED.verdict,
         weight = EXCLUDED.weight,
         reputation_score = EXCLUDED.reputation_score,
         reputation_code = EXCLUDED.reputation_code,
         confidence_score = EXCLUDED.confidence_score,
         expertise_key = EXCLUDED.expertise_key,
         expertise_tier = EXCLUDED.expertise_tier,
         reason = EXCLUDED.reason,
         updated_at = NOW()
       RETURNING *`,
      [
        contributionId,
        userId,
        normalizedVerdict,
        weight,
        Number(reputation.score || 0),
        reputation.code,
        Number(reputation.confidence?.score || 0),
        expertise?.expertiseKey || contributionDomain(contribution.type).key,
        expertise?.tier || 'BUILDING',
        normalizedReason
      ]
    );

    const consensus = await recalculateState(contributionId, contribution.type, client);
    return {
      vote: mapVote(voteResult.rows[0]),
      verifierReliability: verificationStats,
      consensus
    };
  });
}

export async function listCommunityVerificationQueue(userId, {
  limit = 20,
  offset = 0
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { rows } = await pool.query(
    `SELECT
       c.id, c.user_id, c.place_id, c.type, c.payload, c.created_at, c.risk_score,
       u.name AS user_name,
       p.name AS place_name,
       cvs.state, cvs.required_voters,
       cvs.confirm_count, cvs.dispute_count, cvs.unsure_count,
       cvs.confirm_weight, cvs.dispute_weight, cvs.unsure_weight,
       cvs.agreement_ratio, cvs.confidence, cvs.updated_at AS consensus_updated_at,
       mine.verdict AS my_verdict,
       mine.reason AS my_reason,
       mine.weight AS my_weight
     FROM contributions c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN places p ON p.id = c.place_id
     LEFT JOIN community_verification_states cvs ON cvs.contribution_id = c.id
     LEFT JOIN community_verifications mine
       ON mine.contribution_id = c.id
      AND mine.user_id = $1
     WHERE c.status = 'PENDING'
       AND c.user_id <> $1
       AND COALESCE(c.risk_score, 0) < 70
     ORDER BY
       CASE WHEN mine.verdict IS NULL THEN 0 ELSE 1 END,
       CASE COALESCE(cvs.state, 'COLLECTING')
         WHEN 'COLLECTING' THEN 0
         WHEN 'SPLIT' THEN 1
         WHEN 'DISPUTED' THEN 2
         WHEN 'CONFIRMED' THEN 3
         ELSE 4
       END,
       c.created_at ASC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset]
  );

  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userName: row.user_name,
    placeId: row.place_id == null ? null : String(row.place_id),
    placeName: row.place_name || null,
    type: row.type,
    payload: row.payload || {},
    createdAt: row.created_at,
    verification: {
      ...mapState(row.state ? {
        state: row.state,
        required_voters: row.required_voters,
        confirm_count: row.confirm_count,
        dispute_count: row.dispute_count,
        unsure_count: row.unsure_count,
        confirm_weight: row.confirm_weight,
        dispute_weight: row.dispute_weight,
        unsure_weight: row.unsure_weight,
        agreement_ratio: row.agreement_ratio,
        confidence: row.confidence,
        updated_at: row.consensus_updated_at
      } : null, row.type),
      myVote: row.my_verdict ? {
        verdict: row.my_verdict,
        reason: row.my_reason || null,
        weight: Number(row.my_weight || 0)
      } : null
    }
  }));
}
