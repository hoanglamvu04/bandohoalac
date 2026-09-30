import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_TYPES = new Set([
  'CREATE_PLACE',
  'UPDATE_PLACE',
  'ADD_PHOTO',
  'FIX_LOCATION',
  'UPDATE_HOURS',
  'UPDATE_PRICE',
  'REPORT_CLOSED',
  'REPORT_WRONG_INFO'
]);

function normalizeTypes(types) {
  if (!Array.isArray(types)) return [];
  return [...new Set(types.map((value) => String(value).trim()).filter((value) => ALLOWED_TYPES.has(value)))];
}

function mapMission(row) {
  if (!row) return null;
  const approvedCount = Number(row.approved_count || 0);
  const targetCount = Number(row.target_count || 1);
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    status: row.status,
    contributionTypes: Array.isArray(row.contribution_types) ? row.contribution_types : [],
    targetCount,
    bonusPoints: Number(row.bonus_points || 0),
    completionBonus: Number(row.completion_bonus || 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    approvedCount,
    completed: Boolean(row.completed),
    progress: Math.min(targetCount > 0 ? approvedCount / targetCount : 0, 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const MISSION_SELECT = `
  SELECT
    m.*,
    0::int AS approved_count,
    FALSE AS completed
  FROM missions m
`;

export async function listMissionsAdmin({ status = 'ALL' } = {}) {
  const params = [];
  let where = '';
  if (status && status !== 'ALL') {
    params.push(status);
    where = ' WHERE m.status = $1';
  }
  const { rows } = await pool.query(
    MISSION_SELECT + where + ' ORDER BY m.updated_at DESC',
    params
  );
  return rows.map(mapMission);
}

export async function getMissionAdmin(id, client = pool) {
  const { rows } = await client.query(MISSION_SELECT + ' WHERE m.id = $1', [id]);
  return mapMission(rows[0]);
}

export async function createMission(data, adminId) {
  const types = normalizeTypes(data.contributionTypes);
  const { rows } = await pool.query(
    `INSERT INTO missions (
      title, description, status, contribution_types, target_count,
      bonus_points, completion_bonus, starts_at, ends_at,
      created_by, updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
    RETURNING id`,
    [
      data.title,
      data.description || null,
      data.status || 'DRAFT',
      types,
      Number(data.targetCount || 1),
      Number(data.bonusPoints || 0),
      Number(data.completionBonus || 0),
      data.startsAt || null,
      data.endsAt || null,
      adminId
    ]
  );
  return getMissionAdmin(rows[0].id);
}

export async function updateMission(id, values, adminId) {
  const map = {
    title: 'title',
    description: 'description',
    status: 'status',
    targetCount: 'target_count',
    bonusPoints: 'bonus_points',
    completionBonus: 'completion_bonus',
    startsAt: 'starts_at',
    endsAt: 'ends_at'
  };

  const params = [];
  const sets = [];

  for (const [key, value] of Object.entries(values || {})) {
    if (key === 'contributionTypes') {
      params.push(normalizeTypes(value));
      sets.push('contribution_types = $' + params.length);
      continue;
    }
    if (!map[key]) continue;
    params.push(value);
    sets.push(map[key] + ' = $' + params.length);
  }

  if (!sets.length) return getMissionAdmin(id);

  params.push(adminId);
  sets.push('updated_by = $' + params.length, 'updated_at = NOW()');
  params.push(id);

  const { rows } = await pool.query(
    'UPDATE missions SET ' + sets.join(', ') + ' WHERE id = $' + params.length + ' RETURNING id',
    params
  );
  if (!rows[0]) throw new AppError('Mission not found.', 404);
  return getMissionAdmin(id);
}

export async function listPublicMissions(userId = null) {
  const params = [];
  let progressJoin = '0::int AS approved_count, FALSE AS completed';

  if (userId) {
    params.push(userId);
    progressJoin = `
      COALESCE((
        SELECT COUNT(*)::int
        FROM mission_contributions mc
        WHERE mc.mission_id = m.id AND mc.user_id = $1
      ), 0) AS approved_count,
      EXISTS (
        SELECT 1
        FROM mission_completions mco
        WHERE mco.mission_id = m.id AND mco.user_id = $1
      ) AS completed
    `;
  }

  const { rows } = await pool.query(
    `SELECT m.*, ${progressJoin}
     FROM missions m
     WHERE m.status = 'ACTIVE'
       AND (m.starts_at IS NULL OR m.starts_at <= NOW())
       AND (m.ends_at IS NULL OR m.ends_at >= NOW())
     ORDER BY m.updated_at DESC`,
    params
  );

  return rows.map(mapMission);
}

async function awardMissionPoints({ client, userId, contributionId, amount, reason }) {
  if (amount <= 0) return;

  await client.query(
    `INSERT INTO points_transactions (user_id, contribution_id, amount, reason)
     VALUES ($1,$2,$3,$4)`,
    [userId, contributionId, amount, reason]
  );

  await client.query(
    `UPDATE users
     SET points_total = points_total + $1,
         points_balance = points_balance + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [amount, userId]
  );
}

export async function applyMissionBonusesForContribution({
  contributionId,
  userId,
  type,
  client
}) {
  const { rows: missions } = await client.query(
    `SELECT *
     FROM missions
     WHERE status = 'ACTIVE'
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
       AND (
         cardinality(contribution_types) = 0
         OR $1 = ANY(contribution_types)
       )
     FOR UPDATE`,
    [type]
  );

  const awarded = [];

  for (const mission of missions) {
    const insertResult = await client.query(
      `INSERT INTO mission_contributions (
         mission_id, contribution_id, user_id, bonus_points_awarded
       )
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (mission_id, contribution_id) DO NOTHING
       RETURNING id`,
      [mission.id, contributionId, userId, Number(mission.bonus_points || 0)]
    );

    if (!insertResult.rows[0]) continue;

    const perContributionBonus = Number(mission.bonus_points || 0);
    await awardMissionPoints({
      client,
      userId,
      contributionId,
      amount: perContributionBonus,
      reason: 'MISSION_BONUS:' + mission.id
    });

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM mission_contributions
       WHERE mission_id = $1 AND user_id = $2`,
      [mission.id, userId]
    );

    const count = Number(countResult.rows[0]?.count || 0);
    let completionBonus = 0;

    if (count >= Number(mission.target_count || 1)) {
      const completionResult = await client.query(
        `INSERT INTO mission_completions (
           mission_id, user_id, points_awarded
         )
         VALUES ($1,$2,$3)
         ON CONFLICT (mission_id, user_id) DO NOTHING
         RETURNING id`,
        [mission.id, userId, Number(mission.completion_bonus || 0)]
      );

      if (completionResult.rows[0]) {
        completionBonus = Number(mission.completion_bonus || 0);
        await awardMissionPoints({
          client,
          userId,
          contributionId,
          amount: completionBonus,
          reason: 'MISSION_COMPLETION:' + mission.id
        });
      }
    }

    awarded.push({
      missionId: String(mission.id),
      title: mission.title,
      perContributionBonus,
      completionBonus,
      progress: count,
      targetCount: Number(mission.target_count || 1)
    });
  }

  return awarded;
}
