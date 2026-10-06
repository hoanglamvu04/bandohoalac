import { pool, withTransaction } from '../database/pool.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const DOMAIN_DEFINITIONS = {
  PLACE_DATA: {
    label: 'Dữ liệu địa điểm',
    types: ['CREATE_PLACE', 'UPDATE_PLACE', 'REPORT_CLOSED', 'REPORT_WRONG_INFO']
  },
  MEDIA: {
    label: 'Ảnh thực tế',
    types: ['ADD_PHOTO']
  },
  LOCATION: {
    label: 'Tọa độ & vị trí',
    types: ['FIX_LOCATION']
  },
  LOCAL_INFO: {
    label: 'Thông tin địa phương',
    types: ['UPDATE_HOURS', 'UPDATE_PRICE']
  },
  ROAD_SAFETY: {
    label: 'Giao thông & an toàn',
    types: ['REPORT_FLOOD', 'REPORT_ROAD_CLOSURE', 'REPORT_ALERT']
  }
};

// Specific communes must be checked before broader district/area names.
// Example: "Yên Xuân, Thạch Thất" should count for Yên Xuân, not Thạch Thất.
const AREA_DEFINITIONS = [
  { key: 'HOA_LAC', label: 'Hòa Lạc', aliases: ['hoa lac'] },
  { key: 'HA_BANG', label: 'Hạ Bằng', aliases: ['ha bang'] },
  { key: 'TAY_PHUONG', label: 'Tây Phương', aliases: ['tay phuong'] },
  { key: 'YEN_XUAN', label: 'Yên Xuân', aliases: ['yen xuan'] },
  { key: 'PHU_CAT', label: 'Phú Cát', aliases: ['phu cat'] },
  { key: 'THACH_THAT', label: 'Thạch Thất', aliases: ['thach that'] },
  { key: 'BA_VI', label: 'Ba Vì', aliases: ['ba vi'] },
  { key: 'QUOC_OAI', label: 'Quốc Oai', aliases: ['quoc oai'] }
];

const TIER_RANK = { BUILDING: 0, SPECIALIST: 1, EXPERT: 2 };

function round(value, digits = 0) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function daysSince(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function contributionDomain(type) {
  for (const [key, definition] of Object.entries(DOMAIN_DEFINITIONS)) {
    if (definition.types.includes(type)) return { key, label: definition.label };
  }
  return { key: 'GENERAL', label: 'Đóng góp tổng hợp' };
}

export function detectAreaFromAddress(address) {
  const normalized = normalizeText(address);
  if (!normalized) return null;
  for (const area of AREA_DEFINITIONS) {
    if (area.aliases.some((alias) => normalized.includes(alias))) {
      return { key: area.key, label: area.label };
    }
  }
  return null;
}

export function calculateExpertise(input = {}, now = new Date()) {
  const approvedCount = Math.max(Number(input.approvedCount) || 0, 0);
  const rejectedCount = Math.max(Number(input.rejectedCount) || 0, 0);
  const reviewedCount = approvedCount + rejectedCount;
  const qualityPoints = Math.max(Number(input.qualityPoints) || 0, 0);
  const approvalRate = reviewedCount > 0 ? approvedCount / reviewedCount : null;
  const ageDays = daysSince(input.lastReviewedAt, now);
  const recency = ageDays == null
    ? 0
    : Math.max(0, 1 - Math.min(ageDays / 365, 1));

  const components = {
    evidence: round(Math.min(approvedCount / 20, 1) * 45, 1),
    accuracy: round((approvalRate || 0) * Math.min(reviewedCount / 10, 1) * 25, 1),
    quality: round(Math.min(qualityPoints / 250, 1) * 20, 1),
    recency: round(recency * 10, 1)
  };
  const score = Math.min(100, Math.round(
    components.evidence + components.accuracy + components.quality + components.recency
  ));

  let tier = 'BUILDING';
  if (
    score >= 70 &&
    approvedCount >= 12 &&
    (approvalRate || 0) >= 0.8 &&
    qualityPoints >= 100
  ) {
    tier = 'EXPERT';
  } else if (
    score >= 45 &&
    approvedCount >= 6 &&
    (approvalRate || 0) >= 0.7 &&
    qualityPoints >= 40
  ) {
    tier = 'SPECIALIST';
  }

  return {
    score,
    tier,
    components,
    metrics: {
      approvedCount,
      rejectedCount,
      reviewedCount,
      approvalRate: approvalRate == null ? null : round(approvalRate, 4),
      qualityPoints,
      lastReviewedAt: input.lastReviewedAt || null,
      daysSinceLastReview: ageDays
    }
  };
}

function badgeForItem(item) {
  if (!item || item.tier === 'BUILDING') return null;
  const isArea = item.dimension === 'AREA';
  return {
    code: `${item.dimension}_${item.expertiseKey}_${item.tier}`,
    dimension: item.dimension,
    key: item.expertiseKey,
    tier: item.tier,
    score: item.score,
    title: item.tier === 'EXPERT'
      ? (isArea ? `Chuyên gia ${item.label}` : `Chuyên gia ${item.label.toLowerCase()}`)
      : (isArea ? `Am hiểu ${item.label}` : `Chuyên môn ${item.label.toLowerCase()}`),
    label: item.label
  };
}

function rowToExpertise(row, now = new Date()) {
  const calculated = calculateExpertise({
    approvedCount: row.approved_count,
    rejectedCount: row.rejected_count,
    qualityPoints: row.quality_points,
    lastReviewedAt: row.last_reviewed_at
  }, now);
  return {
    dimension: row.dimension,
    expertiseKey: row.expertise_key,
    label: row.label,
    ...calculated
  };
}

function aggregateContribution(aggregate, key, label, contribution) {
  const current = aggregate.get(key) || {
    key,
    label,
    approvedCount: 0,
    rejectedCount: 0,
    qualityPoints: 0,
    lastReviewedAt: null
  };
  if (contribution.status === 'APPROVED') current.approvedCount += 1;
  if (contribution.status === 'REJECTED') current.rejectedCount += 1;
  current.qualityPoints += Number(contribution.quality_points || 0);
  if (
    contribution.reviewed_at &&
    (!current.lastReviewedAt || new Date(contribution.reviewed_at) > new Date(current.lastReviewedAt))
  ) {
    current.lastReviewedAt = contribution.reviewed_at;
  }
  aggregate.set(key, current);
}

async function loadExistingTierMap(userId, client) {
  const { rows } = await client.query(
    `SELECT dimension, expertise_key, label, approved_count, rejected_count,
            quality_points, last_reviewed_at
     FROM reputation_expertise
     WHERE user_id = $1`,
    [userId]
  );
  const map = new Map();
  for (const row of rows) {
    const item = rowToExpertise(row);
    map.set(`${item.dimension}:${item.expertiseKey}`, item);
  }
  return map;
}

export async function refreshUserExpertise(userId, client = pool) {
  const existing = await loadExistingTierMap(userId, client);
  const { rows } = await client.query(
    `SELECT
       c.id, c.type, c.status, c.reviewed_at, c.payload,
       p.address AS place_address,
       COALESCE((
         SELECT SUM(pt.amount)
         FROM points_transactions pt
         WHERE pt.contribution_id = c.id
           AND pt.user_id = c.user_id
           AND pt.amount > 0
           AND pt.reason LIKE '%_QUALITY_APPROVED'
       ), 0)::int AS quality_points
     FROM contributions c
     LEFT JOIN places p ON p.id = c.place_id
     WHERE c.user_id = $1
       AND c.status IN ('APPROVED', 'REJECTED')
       AND c.reviewed_at IS NOT NULL
     ORDER BY c.reviewed_at ASC, c.id ASC`,
    [userId]
  );

  const domains = new Map();
  const areas = new Map();
  for (const row of rows) {
    const domain = contributionDomain(row.type);
    aggregateContribution(domains, domain.key, domain.label, row);

    const payloadAddress = row.payload?.place?.address || row.payload?.address || '';
    const area = detectAreaFromAddress(row.place_address || payloadAddress);
    if (area) aggregateContribution(areas, area.key, area.label, row);
  }

  await client.query('DELETE FROM reputation_expertise WHERE user_id = $1', [userId]);
  const combined = [
    ...[...domains.values()].map((item) => ({ dimension: 'DOMAIN', ...item })),
    ...[...areas.values()].map((item) => ({ dimension: 'AREA', ...item }))
  ];

  for (const item of combined) {
    await client.query(
      `INSERT INTO reputation_expertise (
         user_id, dimension, expertise_key, label,
         approved_count, rejected_count, quality_points, last_reviewed_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        userId,
        item.dimension,
        item.key,
        item.label,
        item.approvedCount,
        item.rejectedCount,
        item.qualityPoints,
        item.lastReviewedAt
      ]
    );
  }

  const refreshed = await getUserExpertise(userId, { refreshIfEmpty: false }, client);
  const unlockedBadges = [];
  for (const item of [...refreshed.areas, ...refreshed.domains]) {
    if (item.tier === 'BUILDING') continue;
    const previous = existing.get(`${item.dimension}:${item.expertiseKey}`);
    const previousRank = TIER_RANK[previous?.tier || 'BUILDING'] || 0;
    const currentRank = TIER_RANK[item.tier] || 0;
    if (currentRank > previousRank) {
      const badge = badgeForItem(item);
      if (badge) unlockedBadges.push(badge);
    }
  }

  return { ...refreshed, unlockedBadges };
}

async function readExpertiseRows(userId, client) {
  const { rows } = await client.query(
    `SELECT dimension, expertise_key, label, approved_count, rejected_count,
            quality_points, last_reviewed_at, updated_at
     FROM reputation_expertise
     WHERE user_id = $1
     ORDER BY approved_count DESC, quality_points DESC, expertise_key ASC`,
    [userId]
  );
  return rows;
}

export async function getUserExpertise(userId, { refreshIfEmpty = true } = {}, client = pool) {
  let rows = await readExpertiseRows(userId, client);
  if (!rows.length && refreshIfEmpty) {
    const reviewed = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM contributions
       WHERE user_id = $1
         AND status IN ('APPROVED', 'REJECTED')
         AND reviewed_at IS NOT NULL`,
      [userId]
    );
    if (Number(reviewed.rows[0]?.count || 0) > 0) {
      return refreshUserExpertise(userId, client);
    }
  }

  const items = rows.map((row) => rowToExpertise(row));
  const areas = items
    .filter((item) => item.dimension === 'AREA')
    .sort((a, b) => b.score - a.score || b.metrics.approvedCount - a.metrics.approvedCount);
  const domains = items
    .filter((item) => item.dimension === 'DOMAIN')
    .sort((a, b) => b.score - a.score || b.metrics.approvedCount - a.metrics.approvedCount);
  const badges = [...areas, ...domains]
    .map(badgeForItem)
    .filter(Boolean)
    .sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) || b.score - a.score);

  return {
    version: '2.3',
    areas,
    domains,
    primaryArea: areas[0] || null,
    primaryDomain: domains[0] || null,
    badges,
    specialistCount: badges.filter((badge) => badge.tier === 'SPECIALIST').length,
    expertCount: badges.filter((badge) => badge.tier === 'EXPERT').length
  };
}

export async function getDomainExpertise(userId, contributionType, client = pool) {
  const domain = contributionDomain(contributionType);
  const { rows } = await client.query(
    `SELECT dimension, expertise_key, label, approved_count, rejected_count,
            quality_points, last_reviewed_at
     FROM reputation_expertise
     WHERE user_id = $1
       AND dimension = 'DOMAIN'
       AND expertise_key = $2`,
    [userId, domain.key]
  );
  return rows[0] ? rowToExpertise(rows[0]) : null;
}

export function expertisePriorityBoost({ expertise, reputation }) {
  if (!expertise || expertise.tier !== 'EXPERT') return 0;
  const allowedLevels = ['CONTRIBUTOR', 'TRUSTED_CONTRIBUTOR', 'LOCAL_EXPERT'];
  if (!allowedLevels.includes(reputation?.code)) return 0;
  if (Number(reputation?.confidence?.score || 0) < 60) return 0;
  return 1;
}

export async function refreshUserExpertiseTransactional(userId) {
  return withTransaction((client) => refreshUserExpertise(userId, client));
}
