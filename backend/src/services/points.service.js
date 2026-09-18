export const POINTS_BY_TYPE = {
  CREATE_PLACE: 20,
  ADD_PHOTO: 3,
  UPDATE_PLACE: 5,
  FIX_LOCATION: 10,
  UPDATE_HOURS: 5,
  UPDATE_PRICE: 5,
  REPORT_CLOSED: 2,
  REPORT_WRONG_INFO: 2
};

const TRUST_GAIN_ON_APPROVE = 2;
const TRUST_LOSS_ON_REJECT = 5;
const TRUST_MIN = 0;
const TRUST_MAX = 100;

export async function awardPointsForApproval({ userId, contributionId, type }, client) {
  const amount = POINTS_BY_TYPE[type] || 0;

  if (amount > 0) {
    await client.query(
      `INSERT INTO points_transactions (user_id, contribution_id, amount, reason)
       VALUES ($1, $2, $3, $4)`,
      [userId, contributionId, amount, `${type}_APPROVED`]
    );
  }

  await client.query(
    `UPDATE users
     SET points_total = points_total + $1,
         approved_count = approved_count + 1,
         trust_score = LEAST($3, trust_score + $2),
         updated_at = NOW()
     WHERE id = $4`,
    [amount, TRUST_GAIN_ON_APPROVE, TRUST_MAX, userId]
  );

  return amount;
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
