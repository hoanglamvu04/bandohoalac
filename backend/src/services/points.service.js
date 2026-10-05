import { CONTRIBUTION_MAX_POINTS } from './contributionScoring.service.js';

const TRUST_GAIN_ON_APPROVE = 2;
const TRUST_LOSS_ON_REJECT = 5;
const TRUST_MIN = 0;
const TRUST_MAX = 100;

function normalizeAwardAmount(value) {
  const amount = Math.round(Number(value) || 0);
  return Math.min(CONTRIBUTION_MAX_POINTS, Math.max(0, amount));
}

export async function awardPointsForApproval({
  userId,
  contributionId,
  type,
  amount
}, client) {
  const awarded = normalizeAwardAmount(amount);

  if (awarded > 0) {
    await client.query(
      `INSERT INTO points_transactions (user_id, contribution_id, amount, reason)
       VALUES ($1, $2, $3, $4)`,
      [userId, contributionId, awarded, `${type}_QUALITY_APPROVED`]
    );
  }

  await client.query(
    `UPDATE users
     SET points_total = points_total + $1,
         points_balance = points_balance + $1,
         approved_count = approved_count + 1,
         trust_score = LEAST($3, trust_score + $2),
         updated_at = NOW()
     WHERE id = $4`,
    [awarded, TRUST_GAIN_ON_APPROVE, TRUST_MAX, userId]
  );

  return awarded;
}

export async function penalizeRejection(userId, client) {
  await client.query(
    `UPDATE users
     SET rejected_count = rejected_count + 1,
         trust_score = GREATEST($1, trust_score - $2),
         updated_at = NOW()
     WHERE id = $3`,
    [TRUST_MIN, TRUST_LOSS_ON_REJECT, userId]
  );
}
