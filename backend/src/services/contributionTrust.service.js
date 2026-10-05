import crypto from 'node:crypto';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

const HIGH_IMPACT_TYPES = new Set([
  'REPORT_CLOSED',
  'FIX_LOCATION',
  'REPORT_ROAD_CLOSURE',
  'REPORT_FLOOD'
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function rounded(value, digits = 5) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

export function contributionRiskBand(score) {
  const value = Number(score) || 0;
  if (value >= 70) return 'HIGH';
  if (value >= 40) return 'MEDIUM';
  return 'LOW';
}

export function buildContributionFingerprint({ type, placeId, payload = {} }) {
  const place = payload.place || {};
  const location = payload.location || {};
  const compact = {
    type,
    placeId: placeId || null,
    lat: rounded(location.lat),
    lng: rounded(location.lng),
    name: normalizeText(place.name),
    address: normalizeText(place.address),
    phone: normalizeText(place.phone),
    website: normalizeText(place.website),
    openingHours: normalizeText(place.openingHours),
    price: normalizeText(place.price),
    reason: normalizeText(payload.reason)
  };
  return crypto.createHash('sha256').update(JSON.stringify(compact)).digest('hex');
}

export async function evaluateContributionRisk({ userId, type, placeId, payload, fingerprint }, client = pool) {
  const [userResult, recentResult, ownDuplicateResult, globalDuplicateResult] = await Promise.all([
    client.query(
      `SELECT id, created_at, trust_score, approved_count, rejected_count
       FROM users WHERE id = $1`,
      [userId]
    ),
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::int AS hour_count,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '10 minutes')::int AS ten_minute_count,
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count
       FROM contributions
       WHERE user_id = $1`,
      [userId]
    ),
    client.query(
      `SELECT id, created_at
       FROM contributions
       WHERE user_id = $1
         AND fingerprint = $2
         AND created_at >= NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, fingerprint]
    ),
    client.query(
      `SELECT COUNT(*)::int AS count
       FROM contributions
       WHERE fingerprint = $1
         AND user_id <> $2
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [fingerprint, userId]
    )
  ]);

  const user = userResult.rows[0];
  const recent = recentResult.rows[0] || {};
  const flags = [];
  let score = 0;

  if (ownDuplicateResult.rows[0]) {
    flags.push({ code: 'EXACT_DUPLICATE', weight: 85, detail: 'Nội dung trùng với đóng góp trước của cùng tài khoản.' });
    score += 85;
  }

  if (Number(recent.ten_minute_count || 0) >= 5) {
    flags.push({ code: 'BURST_10_MIN', weight: 30, detail: 'Gửi nhiều đóng góp trong 10 phút.' });
    score += 30;
  }

  if (Number(recent.hour_count || 0) >= 12) {
    flags.push({ code: 'BURST_1_HOUR', weight: 45, detail: 'Vượt ngưỡng đóng góp theo giờ.' });
    score += 45;
  }

  if (Number(recent.pending_count || 0) >= 20) {
    flags.push({ code: 'TOO_MANY_PENDING', weight: 20, detail: 'Có quá nhiều đóng góp đang chờ duyệt.' });
    score += 20;
  }

  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
  if (createdAt && Date.now() - createdAt < 24 * 60 * 60 * 1000) {
    flags.push({ code: 'NEW_ACCOUNT', weight: 10, detail: 'Tài khoản mới dưới 24 giờ.' });
    score += 10;
  }

  const approved = Number(user?.approved_count || 0);
  const rejected = Number(user?.rejected_count || 0);
  const reviewed = approved + rejected;
  if (reviewed >= 5 && rejected / reviewed >= 0.5) {
    flags.push({ code: 'HIGH_REJECTION_RATE', weight: 20, detail: 'Tỷ lệ đóng góp bị từ chối cao.' });
    score += 20;
  }

  if (Number(globalDuplicateResult.rows[0]?.count || 0) >= 2) {
    flags.push({ code: 'CROSS_ACCOUNT_DUPLICATE', weight: 15, detail: 'Nội dung tương tự đang được nhiều tài khoản gửi.' });
    score += 15;
  }

  if (HIGH_IMPACT_TYPES.has(type)) {
    flags.push({ code: 'HIGH_IMPACT_TYPE', weight: 10, detail: 'Loại đóng góp có ảnh hưởng lớn tới dữ liệu bản đồ.' });
    score += 10;
  }

  if (type === 'CREATE_PLACE' && !payload?.photoAssets?.length && !payload?.photos?.length) {
    flags.push({ code: 'NEW_PLACE_NO_PHOTO', weight: 10, detail: 'Địa điểm mới chưa có ảnh minh chứng.' });
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));

  const blocked = flags.some((flag) => flag.code === 'EXACT_DUPLICATE')
    || Number(recent.hour_count || 0) >= 20;

  return {
    score,
    band: contributionRiskBand(score),
    flags,
    blocked,
    blockReason: flags.find((flag) => flag.code === 'EXACT_DUPLICATE')?.detail
      || (Number(recent.hour_count || 0) >= 20 ? 'Bạn đã gửi quá nhiều đóng góp trong một giờ.' : null)
  };
}

export function assertCtvCanModerate(user, contribution) {
  if (!user) throw new AppError('Authentication required.', 401);
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') return true;
  if (user.role !== 'CTV') throw new AppError('Bạn không có quyền kiểm duyệt đóng góp.', 403);

  const level = Number(user.ctvLevel || user.ctv_level || 1);
  if (level >= 2) return true;

  const riskScore = Number(contribution?.risk_score ?? contribution?.riskScore ?? 0);
  if (riskScore >= 50 || HIGH_IMPACT_TYPES.has(contribution?.type)) {
    throw new AppError('Đóng góp rủi ro cao cần CTV cấp 2 hoặc quản trị viên duyệt.', 403);
  }
  return true;
}

export async function recordCtvReview(reviewerId, client = pool) {
  await client.query(
    `UPDATE users
     SET ctv_reviews_count = ctv_reviews_count + 1,
         updated_at = NOW()
     WHERE id = $1 AND role = 'CTV'`,
    [reviewerId]
  );
}

export function computeCtvTrust({ reviews = 0, confirmed = 0, overturned = 0 }) {
  const score = Math.max(0, Math.min(100, 60 + Number(confirmed) * 2 - Number(overturned) * 10));
  const level = Number(reviews) >= 20 && Number(confirmed) >= 10 && score >= 80 ? 2 : 1;
  return { score, level };
}

export async function auditCtvModeration({ contributionId, adminId, verdict, note }, client = pool) {
  const { rows } = await client.query(
    `SELECT c.id, c.reviewed_by, u.role
     FROM contributions c
     LEFT JOIN users u ON u.id = c.reviewed_by
     WHERE c.id = $1`,
    [contributionId]
  );
  const contribution = rows[0];
  if (!contribution) throw new AppError('Contribution not found.', 404);
  if (!contribution.reviewed_by || contribution.role !== 'CTV') {
    throw new AppError('Đóng góp này không được kiểm duyệt bởi CTV.', 400);
  }

  await client.query(
    `INSERT INTO ctv_moderation_audits
       (contribution_id, reviewer_user_id, audited_by, verdict, note)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (contribution_id)
     DO UPDATE SET verdict = EXCLUDED.verdict,
                   note = EXCLUDED.note,
                   audited_by = EXCLUDED.audited_by,
                   updated_at = NOW()`,
    [contributionId, contribution.reviewed_by, adminId, verdict, note || null]
  );

  const stats = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE verdict = 'CONFIRMED')::int AS confirmed,
       COUNT(*) FILTER (WHERE verdict = 'OVERTURNED')::int AS overturned
     FROM ctv_moderation_audits
     WHERE reviewer_user_id = $1`,
    [contribution.reviewed_by]
  );
  const userResult = await client.query(
    'SELECT ctv_reviews_count FROM users WHERE id = $1 FOR UPDATE',
    [contribution.reviewed_by]
  );
  const reviews = Number(userResult.rows[0]?.ctv_reviews_count || 0);
  const confirmed = Number(stats.rows[0]?.confirmed || 0);
  const overturned = Number(stats.rows[0]?.overturned || 0);
  const trust = computeCtvTrust({ reviews, confirmed, overturned });

  await client.query(
    `UPDATE users
     SET ctv_confirmed_count = $2,
         ctv_overturned_count = $3,
         ctv_trust_score = $4,
         ctv_level = $5,
         updated_at = NOW()
     WHERE id = $1`,
    [contribution.reviewed_by, confirmed, overturned, trust.score, trust.level]
  );

  return {
    reviewerUserId: String(contribution.reviewed_by),
    reviews,
    confirmed,
    overturned,
    trustScore: trust.score,
    ctvLevel: trust.level
  };
}
