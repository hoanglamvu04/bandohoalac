import { pool } from '../database/pool.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const REPUTATION_LEVELS = [
  {
    code: 'NEW_MEMBER',
    name: 'Thành viên mới',
    minScore: 0,
    requirements: {}
  },
  {
    code: 'EXPLORER',
    name: 'Người khám phá',
    minScore: 15,
    requirements: { approvedCount: 2, qualityPoints: 10 }
  },
  {
    code: 'CONTRIBUTOR',
    name: 'Người đóng góp',
    minScore: 35,
    requirements: { approvedCount: 8, approvalRate: 0.6, qualityPoints: 60 }
  },
  {
    code: 'TRUSTED_CONTRIBUTOR',
    name: 'Người đóng góp tin cậy',
    minScore: 60,
    requirements: {
      approvedCount: 20,
      approvalRate: 0.75,
      trustScore: 65,
      qualityPoints: 220,
      accountAgeDays: 14
    }
  },
  {
    code: 'LOCAL_EXPERT',
    name: 'Chuyên gia địa phương',
    minScore: 80,
    requirements: {
      approvedCount: 50,
      approvalRate: 0.85,
      trustScore: 80,
      qualityPoints: 600,
      accountAgeDays: 45
    }
  }
];

const REPUTATION_PERMISSIONS = {
  NEW_MEMBER: {
    moderationPriority: 0,
    priorityLabel: 'Tiêu chuẩn',
    advancedSuggestions: false,
    sensitiveCorrections: false,
    expeditedReview: false,
    selfApproval: false
  },
  EXPLORER: {
    moderationPriority: 1,
    priorityLabel: 'Tiêu chuẩn+',
    advancedSuggestions: false,
    sensitiveCorrections: false,
    expeditedReview: false,
    selfApproval: false
  },
  CONTRIBUTOR: {
    moderationPriority: 2,
    priorityLabel: 'Ưu tiên',
    advancedSuggestions: true,
    sensitiveCorrections: false,
    expeditedReview: false,
    selfApproval: false
  },
  TRUSTED_CONTRIBUTOR: {
    moderationPriority: 3,
    priorityLabel: 'Ưu tiên cao',
    advancedSuggestions: true,
    sensitiveCorrections: true,
    expeditedReview: true,
    selfApproval: false
  },
  LOCAL_EXPERT: {
    moderationPriority: 4,
    priorityLabel: 'Chuyên gia',
    advancedSuggestions: true,
    sensitiveCorrections: true,
    expeditedReview: true,
    selfApproval: false
  }
};

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function round(value, digits = 0) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function accountAgeDays(createdAt, now = new Date()) {
  const created = createdAt ? new Date(createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS));
}

function meetsLevel(level, metrics, score) {
  if (score < level.minScore) return false;
  const req = level.requirements || {};
  if ((req.approvedCount || 0) > metrics.approvedCount) return false;
  if ((req.qualityPoints || 0) > metrics.qualityPoints) return false;
  if ((req.trustScore || 0) > metrics.trustScore) return false;
  if ((req.accountAgeDays || 0) > metrics.accountAgeDays) return false;
  if (req.approvalRate != null && (metrics.approvalRate == null || metrics.approvalRate < req.approvalRate)) {
    return false;
  }
  return true;
}

function requirementRows(level, metrics, score) {
  if (!level) return [];
  const req = level.requirements || {};
  const rows = [
    {
      key: 'score',
      label: 'Uy tín',
      current: score,
      target: level.minScore,
      unit: '/100'
    }
  ];

  if (req.approvedCount) rows.push({
    key: 'approvedCount',
    label: 'Đóng góp được duyệt',
    current: metrics.approvedCount,
    target: req.approvedCount,
    unit: ''
  });
  if (req.qualityPoints) rows.push({
    key: 'qualityPoints',
    label: 'Điểm chất lượng',
    current: metrics.qualityPoints,
    target: req.qualityPoints,
    unit: ''
  });
  if (req.approvalRate != null) rows.push({
    key: 'approvalRate',
    label: 'Tỷ lệ được duyệt',
    current: round((metrics.approvalRate || 0) * 100),
    target: round(req.approvalRate * 100),
    unit: '%'
  });
  if (req.trustScore) rows.push({
    key: 'trustScore',
    label: 'Trust score',
    current: metrics.trustScore,
    target: req.trustScore,
    unit: '/100'
  });
  if (req.accountAgeDays) rows.push({
    key: 'accountAgeDays',
    label: 'Thời gian hoạt động',
    current: metrics.accountAgeDays,
    target: req.accountAgeDays,
    unit: ' ngày'
  });

  return rows.map((row) => ({
    ...row,
    met: row.current >= row.target,
    progress: row.target > 0 ? Math.min(row.current / row.target, 1) : 1
  }));
}

export function getReputationPermissions(reputationOrCode) {
  const code = typeof reputationOrCode === 'string'
    ? reputationOrCode
    : reputationOrCode?.code;
  return {
    ...(REPUTATION_PERMISSIONS[code] || REPUTATION_PERMISSIONS.NEW_MEMBER)
  };
}

export function calculateReputation(input = {}, now = new Date()) {
  const approvedCount = Math.max(Number(input.approvedCount) || 0, 0);
  const rejectedCount = Math.max(Number(input.rejectedCount) || 0, 0);
  const reviewedCount = approvedCount + rejectedCount;
  const qualityPoints = Math.max(Number(input.qualityPoints) || 0, 0);
  const trustScore = clamp(input.trustScore, 0, 100);
  const ageDays = input.accountAgeDays != null
    ? Math.max(Number(input.accountAgeDays) || 0, 0)
    : accountAgeDays(input.createdAt, now);
  const approvalRate = reviewedCount > 0 ? approvedCount / reviewedCount : null;

  const components = {
    quality: round(Math.min(qualityPoints / 600, 1) * 35, 1),
    approval: round((approvalRate || 0) * Math.min(reviewedCount / 12, 1) * 25, 1),
    trust: round((trustScore / 100) * 20, 1),
    helpfulness: round(Math.min(approvedCount / 50, 1) * 15, 1),
    tenure: round(Math.min(ageDays / 180, 1) * 5, 1)
  };

  const score = Math.min(100, Math.round(
    components.quality +
    components.approval +
    components.trust +
    components.helpfulness +
    components.tenure
  ));

  const metrics = {
    qualityPoints,
    approvedCount,
    rejectedCount,
    reviewedCount,
    approvalRate: approvalRate == null ? null : round(approvalRate, 4),
    trustScore,
    accountAgeDays: ageDays
  };

  let current = REPUTATION_LEVELS[0];
  for (const level of REPUTATION_LEVELS) {
    if (meetsLevel(level, metrics, score)) current = level;
  }

  const currentIndex = REPUTATION_LEVELS.findIndex((level) => level.code === current.code);
  const next = REPUTATION_LEVELS[currentIndex + 1] || null;
  const requirements = requirementRows(next, metrics, score);
  const progress = next && requirements.length
    ? round(requirements.reduce((sum, item) => sum + item.progress, 0) / requirements.length, 4)
    : 1;

  return {
    version: '2.1',
    code: current.code,
    name: current.name,
    score,
    progress,
    components,
    metrics,
    permissions: getReputationPermissions(current.code),
    nextLevel: next ? {
      code: next.code,
      name: next.name,
      minScore: next.minScore
    } : null,
    requirements,
    blockers: requirements.filter((item) => !item.met)
  };
}

export async function getUserReputation(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       u.id,
       u.trust_score,
       u.approved_count,
       u.rejected_count,
       u.created_at,
       COALESCE((
         SELECT SUM(pt.amount)
         FROM points_transactions pt
         WHERE pt.user_id = u.id
           AND pt.contribution_id IS NOT NULL
           AND pt.amount > 0
           AND pt.reason LIKE '%_QUALITY_APPROVED'
       ), 0)::int AS quality_points
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );

  const row = rows[0];
  if (!row) return null;
  return calculateReputation({
    qualityPoints: row.quality_points,
    approvedCount: row.approved_count,
    rejectedCount: row.rejected_count,
    trustScore: row.trust_score,
    createdAt: row.created_at
  });
}

export function reputationFromRow(row) {
  return calculateReputation({
    qualityPoints: row.quality_points,
    approvedCount: row.approved_count,
    rejectedCount: row.rejected_count,
    trustScore: row.trust_score,
    createdAt: row.created_at
  });
}

function mapReputationEvent(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    contributionId: row.contribution_id == null ? null : String(row.contribution_id),
    type: row.event_type,
    scoreBefore: Number(row.score_before || 0),
    scoreAfter: Number(row.score_after || 0),
    delta: Number(row.score_delta || 0),
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

export async function getReputationHistory(userId, { limit = 20 } = {}, client = pool) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const { rows } = await client.query(
    `SELECT id, user_id, contribution_id, event_type,
            score_before, score_after, score_delta, metadata, created_at
     FROM reputation_events
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, safeLimit]
  );
  return rows.map(mapReputationEvent);
}

export async function recordReputationEvent({
  userId,
  contributionId = null,
  eventType,
  before,
  after,
  metadata = {}
}, client = pool) {
  if (!before || !after) return null;

  const scoreBefore = Number(before.score || 0);
  const scoreAfter = Number(after.score || 0);
  const eventMetadata = {
    ...metadata,
    levelBefore: { code: before.code, name: before.name },
    levelAfter: { code: after.code, name: after.name },
    componentsBefore: before.components,
    componentsAfter: after.components
  };

  const { rows } = await client.query(
    `INSERT INTO reputation_events (
       user_id, contribution_id, event_type,
       score_before, score_after, score_delta, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, user_id, contribution_id, event_type,
               score_before, score_after, score_delta, metadata, created_at`,
    [
      userId,
      contributionId,
      eventType,
      scoreBefore,
      scoreAfter,
      scoreAfter - scoreBefore,
      JSON.stringify(eventMetadata)
    ]
  );

  return mapReputationEvent(rows[0]);
}

export async function getReputationSignals(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE c.created_at >= NOW() - interval '24 hours')::int AS submissions_24h,
       COUNT(*) FILTER (WHERE c.created_at >= NOW() - interval '7 days')::int AS submissions_7d,
       COUNT(*) FILTER (
         WHERE c.status = 'APPROVED' AND c.reviewed_at >= NOW() - interval '30 days'
       )::int AS approved_30d,
       COUNT(*) FILTER (
         WHERE c.status = 'REJECTED' AND c.reviewed_at >= NOW() - interval '30 days'
       )::int AS rejected_30d,
       COALESCE((
         SELECT COUNT(*)::int
         FROM (
           SELECT fingerprint
           FROM contributions
           WHERE user_id = $1
             AND fingerprint IS NOT NULL
             AND created_at >= NOW() - interval '7 days'
           GROUP BY fingerprint
           HAVING COUNT(*) >= 3
         ) duplicate_groups
       ), 0)::int AS duplicate_clusters_7d
     FROM contributions c
     WHERE c.user_id = $1`,
    [userId]
  );

  const row = rows[0] || {};
  const approved30d = Number(row.approved_30d || 0);
  const rejected30d = Number(row.rejected_30d || 0);
  const reviewed30d = approved30d + rejected30d;
  const rejectionRate30d = reviewed30d > 0 ? round(rejected30d / reviewed30d, 4) : null;
  const signals = {
    submissions24h: Number(row.submissions_24h || 0),
    submissions7d: Number(row.submissions_7d || 0),
    approved30d,
    rejected30d,
    reviewed30d,
    rejectionRate30d,
    duplicateClusters7d: Number(row.duplicate_clusters_7d || 0)
  };

  const flags = [];
  if (signals.submissions24h >= 20) flags.push('HIGH_VOLUME_24H');
  if (signals.duplicateClusters7d >= 2) flags.push('REPEATED_FINGERPRINTS');
  if (reviewed30d >= 5 && rejectionRate30d >= 0.4) flags.push('HIGH_REJECTION_RATE');

  return {
    ...signals,
    flags,
    riskBand: flags.length >= 2 ? 'HIGH' : flags.length === 1 ? 'MEDIUM' : 'LOW'
  };
}

export async function getReputationInspector(userId, client = pool) {
  const [reputation, history, signals] = await Promise.all([
    getUserReputation(userId, client),
    getReputationHistory(userId, { limit: 30 }, client),
    getReputationSignals(userId, client)
  ]);

  if (!reputation) return null;
  return { reputation, history, signals };
}
