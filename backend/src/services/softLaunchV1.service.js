import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { gradeVital } from '../validators/softLaunch.validators.js';

export async function submitSoftLaunchFeedback(input, client = pool) {
  // Deliberate honeypot: do not store obvious automated submissions.
  if (input.website) return { reference: null, accepted: true };

  const { rows: [item] } = await client.query(
    `INSERT INTO soft_launch_feedback(category, area, message)
     VALUES($1, $2, $3) RETURNING public_reference`,
    [input.category, input.area, input.message]
  );
  return { accepted: true, reference: item.public_reference };
}

export async function listSoftLaunchFeedback({ status, page, limit }, client = pool) {
  const where = status ? 'WHERE status = $1' : '';
  const params = status ? [status] : [];
  const [listResult, countResult] = await Promise.all([
    client.query(
      'SELECT id, public_reference, category, area, message, status, internal_note, ' +
      'created_at, updated_at, resolved_at FROM soft_launch_feedback ' + where +
      ' ORDER BY created_at DESC, id DESC LIMIT $' + (params.length + 1) +
      ' OFFSET $' + (params.length + 2),
      [...params, limit, (page - 1) * limit]
    ),
    client.query(
      'SELECT COUNT(*)::int AS total FROM soft_launch_feedback ' + where, params
    )
  ]);

  return {
    items: listResult.rows.map((row) => ({
      id: row.id,
      reference: row.public_reference,
      category: row.category,
      area: row.area,
      message: row.message,
      status: row.status,
      note: row.internal_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at
    })),
    total: countResult.rows[0]?.total || 0,
    page,
    limit
  };
}

export async function reviewSoftLaunchFeedback(id, { status, note }, adminId, client = pool) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    throw new AppError('Invalid feedback ID.', 400);
  }
  const { rows: [item] } = await client.query(
    `UPDATE soft_launch_feedback
       SET status = $2,
           internal_note = COALESCE($3, internal_note),
           reviewed_by = $4,
           resolved_at = CASE WHEN $2 IN ('RESOLVED','DISMISSED')
                            THEN COALESCE(resolved_at, NOW()) ELSE NULL END,
           updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, updated_at`,
    [id, status, note === undefined ? null : note, adminId]
  );
  if (!item) throw new AppError('Feedback not found.', 404);
  return { id: item.id, status: item.status, updatedAt: item.updated_at };
}

export async function recordSoftLaunchVital(input, client = pool) {
  const grade = gradeVital(input.metric, input.value);
  if (!grade) throw new AppError('Invalid performance sample.', 400);

  await client.query(
    `INSERT INTO soft_launch_vitals_hourly(
       bucket_hour, metric, route_group, device, network,
       samples, good, needs_improvement, poor
     ) VALUES(
       date_trunc('hour', NOW()), $1, $2, $3, $4, 1, $5, $6, $7
     )
     ON CONFLICT (bucket_hour, metric, route_group, device, network)
     DO UPDATE SET
       samples = soft_launch_vitals_hourly.samples + 1,
       good = soft_launch_vitals_hourly.good + EXCLUDED.good,
       needs_improvement = soft_launch_vitals_hourly.needs_improvement +
         EXCLUDED.needs_improvement,
       poor = soft_launch_vitals_hourly.poor + EXCLUDED.poor`,
    [
      input.metric, input.routeGroup, input.device, input.network,
      grade === 'good' ? 1 : 0,
      grade === 'needs_improvement' ? 1 : 0,
      grade === 'poor' ? 1 : 0
    ]
  );
}

export async function softLaunchVitalsOverview(client = pool) {
  const { rows } = await client.query(
    `SELECT metric, route_group, device, network,
            SUM(samples)::int AS samples,
            SUM(good)::int AS good,
            SUM(needs_improvement)::int AS needs_improvement,
            SUM(poor)::int AS poor
       FROM soft_launch_vitals_hourly
      WHERE bucket_hour >= date_trunc('hour', NOW() - INTERVAL '24 hours')
      GROUP BY metric, route_group, device, network
      ORDER BY samples DESC, route_group, metric
      LIMIT 250`
  );
  return {
    windowHours: 24,
    source: 'aggregate_field_observations',
    note: 'Các tỷ lệ chỉ phản ánh mẫu trình duyệt có hỗ trợ API đo, không phải mọi lượt truy cập.',
    groups: rows.map((r) => ({
      metric: r.metric,
      routeGroup: r.route_group,
      device: r.device,
      network: r.network,
      samples: r.samples,
      good: r.good,
      needsImprovement: r.needs_improvement,
      poor: r.poor,
      goodPct: r.samples > 0 ? Math.round(r.good * 1000 / r.samples) / 10 : 0
    }))
  };
}

export async function pruneSoftLaunchData(client = pool) {
  // Anonymous but user-authored reports require bounded retention.
  const [a, b] = await Promise.all([
    client.query(
      `DELETE FROM soft_launch_feedback
        WHERE created_at < NOW() - INTERVAL '180 days'`
    ),
    client.query(
      `DELETE FROM soft_launch_vitals_hourly
        WHERE bucket_hour < NOW() - INTERVAL '35 days'`
    )
  ]);
  return { feedbackDeleted: a.rowCount, vitalBucketsDeleted: b.rowCount };
}
