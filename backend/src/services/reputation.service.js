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
    version: 2,
    code: current.code,
    name: current.name,
    score,
    progress,
    components,
    metrics,
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
