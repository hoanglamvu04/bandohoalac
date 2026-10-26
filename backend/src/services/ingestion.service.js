import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { startOverturePlaceScan } from './placeImportRun.service.js';
import { approveHighConfidenceImportedPlaces } from './placeImport.service.js';
import { approvePhotoCandidate, startPhotoScan } from './photoScanner.service.js';

const ACTIVE_JOB_STATUSES = ['QUEUED', 'DISPATCHED', 'RUNNING'];
const SCHEDULED_KEYS = ['OVERTURE_PLACES', 'PHOTO_SCAN', 'FRESHNESS_SWEEP'];

function mapSource(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    key: row.source_key,
    name: row.name,
    kind: row.source_kind,
    collectionMode: row.collection_mode,
    enabled: Boolean(row.enabled),
    scheduleMinutes: row.schedule_minutes === null ? null : Number(row.schedule_minutes),
    confidenceFloor: row.confidence_floor === null ? null : Number(row.confidence_floor),
    autoPublishThreshold: row.auto_publish_threshold === null ? null : Number(row.auto_publish_threshold),
    config: row.config || {},
    policy: row.policy || {},
    lastRunAt: row.last_run_at || null,
    lastSuccessAt: row.last_success_at || null,
    nextRunAt: row.next_run_at || null,
    lastError: row.last_error || null,
    updatedAt: row.updated_at
  };
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    sourceKey: row.source_key || null,
    sourceName: row.source_name || null,
    triggerType: row.trigger_type,
    status: row.status,
    underlyingKind: row.underlying_kind || null,
    underlyingRunId: row.underlying_run_id ? String(row.underlying_run_id) : null,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    stats: row.stats || {},
    errorMessage: row.error_message || null,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    createdAt: row.created_at
  };
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function nextRunSql(minutes) {
  if (!minutes) return null;
  return new Date(Date.now() + Number(minutes) * 60_000);
}

async function getSourceByKey(sourceKey) {
  const { rows } = await pool.query(
    'SELECT * FROM data_sources WHERE source_key = $1 LIMIT 1',
    [String(sourceKey || '').trim().toUpperCase()]
  );
  if (!rows[0]) throw new AppError('Nguồn dữ liệu không tồn tại.', 404);
  return rows[0];
}

async function updateJob(id, fields = {}) {
  const mapping = {
    status: 'status',
    underlyingKind: 'underlying_kind',
    underlyingRunId: 'underlying_run_id',
    stats: 'stats',
    errorMessage: 'error_message'
  };
  const clauses = [];
  const params = [];

  for (const [key, column] of Object.entries(mapping)) {
    if (fields[key] === undefined) continue;
    params.push(key === 'stats' ? JSON.stringify(fields[key] || {}) : fields[key]);
    clauses.push(column + ' = $' + params.length);
  }

  if (fields.startedAtNow) clauses.push('started_at = COALESCE(started_at, NOW())');
  if (fields.finishedAtNow) clauses.push('finished_at = NOW()');
  if (!clauses.length) return;

  params.push(Number(id));
  await pool.query(
    'UPDATE ingestion_jobs SET ' + clauses.join(', ') + ' WHERE id = $' + params.length,
    params
  );
}

async function markSourceResult(sourceId, {
  success = false,
  errorMessage = null,
  nextRunAt
} = {}) {
  const params = [
    success,
    errorMessage ? String(errorMessage).slice(0, 3000) : null,
    nextRunAt || null,
    Number(sourceId)
  ];

  await pool.query(
    `UPDATE data_sources
     SET last_success_at = CASE WHEN $1 THEN NOW() ELSE last_success_at END,
         last_error = CASE WHEN $1 THEN NULL ELSE $2 END,
         next_run_at = COALESCE($3, next_run_at),
         updated_at = NOW()
     WHERE id = $4`,
    params
  );
}

async function autoApproveLicensedPhotos({ threshold = 0.9, limit = 80 } = {}) {
  const safeThreshold = clamp(threshold, 0, 1, 0.9);
  const safeLimit = Math.min(Math.max(Number(limit) || 80, 1), 200);

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (c.place_id) c.id, c.place_id, c.score
     FROM place_photo_candidates c
     WHERE c.status = 'PENDING'
       AND c.source = 'WIKIMEDIA'
       AND c.license_code IS NOT NULL
       AND c.license_code <> ''
       AND c.score >= $1
       AND NOT EXISTS (
         SELECT 1 FROM place_images pi WHERE pi.place_id = c.place_id
       )
     ORDER BY c.place_id, c.score DESC, c.id ASC
     LIMIT $2`,
    [safeThreshold, safeLimit]
  );

  let approvedCount = 0;
  const failed = [];

  for (const row of rows) {
    try {
      await approvePhotoCandidate(row.id, null, { makeCover: true });
      approvedCount += 1;
    } catch (error) {
      failed.push({ id: String(row.id), error: error.message });
    }
  }

  return {
    threshold: safeThreshold,
    requested: rows.length,
    approvedCount,
    failedCount: failed.length,
    failed
  };
}

export async function syncPlaceSourceLinks() {
  await pool.query(
    `INSERT INTO place_source_links (
       place_id, source_id, external_id, confidence, last_seen_at,
       last_verified_at, metadata, updated_at
     )
     SELECT
       ip.approved_place_id,
       ds.id,
       ip.external_id,
       ip.confidence,
       ip.last_seen_at,
       ip.reviewed_at,
       jsonb_build_object(
         'category', ip.mapped_category_slug,
         'operatingStatus', ip.operating_status,
         'importedPlaceId', ip.id
       ),
       NOW()
     FROM imported_places ip
     JOIN data_sources ds ON ds.source_key = 'OVERTURE_PLACES'
     WHERE ip.import_status = 'APPROVED'
       AND ip.approved_place_id IS NOT NULL
     ON CONFLICT (source_id, external_id)
     DO UPDATE SET
       place_id = EXCLUDED.place_id,
       confidence = EXCLUDED.confidence,
       last_seen_at = EXCLUDED.last_seen_at,
       last_verified_at = EXCLUDED.last_verified_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`
  );

  await pool.query(
    `INSERT INTO place_source_links (
       place_id, source_id, external_id, confidence, last_seen_at,
       last_verified_at, metadata, updated_at
     )
     SELECT
       pp.place_id,
       ds.id,
       'partner:' || pp.id::text,
       1.0,
       COALESCE(pp.updated_at, pp.created_at),
       CASE WHEN pp.status = 'ACTIVE' THEN COALESCE(pp.updated_at, pp.joined_at, pp.created_at) ELSE NULL END,
       jsonb_build_object('partnerId', pp.id, 'status', pp.status, 'partnerName', pp.partner_name),
       NOW()
     FROM place_partners pp
     JOIN data_sources ds ON ds.source_key = 'PARTNER_EVENT'
     WHERE pp.status IN ('ACTIVE', 'PAUSED')
     ON CONFLICT (source_id, external_id)
     DO UPDATE SET
       place_id = EXCLUDED.place_id,
       confidence = EXCLUDED.confidence,
       last_seen_at = EXCLUDED.last_seen_at,
       last_verified_at = EXCLUDED.last_verified_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`
  );

  await pool.query(
    `INSERT INTO place_source_links (
       place_id, source_id, external_id, confidence, last_seen_at,
       last_verified_at, metadata, updated_at
     )
     SELECT
       c.place_id,
       ds.id,
       'contribution:' || c.id::text,
       NULL,
       c.created_at,
       c.reviewed_at,
       jsonb_build_object('contributionId', c.id, 'type', c.type, 'userId', c.user_id),
       NOW()
     FROM contributions c
     JOIN data_sources ds ON ds.source_key = 'COMMUNITY_EVENT'
     WHERE c.status = 'APPROVED'
       AND c.place_id IS NOT NULL
     ON CONFLICT (source_id, external_id)
     DO UPDATE SET
       place_id = EXCLUDED.place_id,
       last_seen_at = EXCLUDED.last_seen_at,
       last_verified_at = EXCLUDED.last_verified_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`
  );
}

export async function runFreshnessSweep(config = {}) {
  const placeTtlDays = Math.round(clamp(config.placeTtlDays, 30, 730, 180));
  const housingTtlDays = Math.round(clamp(config.housingTtlDays, 3, 90, 14));

  await pool.query(
    `UPDATE place_verification_queue q
     SET status = 'DONE', updated_at = NOW()
     FROM places p
     WHERE q.place_id = p.id
       AND q.reason = 'STALE_DATA'
       AND q.status = 'PENDING'
       AND p.status = 'PUBLISHED'
       AND COALESCE(p.last_verified_at, p.updated_at, p.created_at) >=
           NOW() - ($1::text || ' days')::interval`,
    [String(placeTtlDays)]
  );

  await pool.query(
    `INSERT INTO place_verification_queue (
       place_id, reason, priority, status, due_at, metadata, updated_at
     )
     SELECT
       p.id,
       'STALE_DATA',
       CASE
         WHEN p.last_verified_at IS NULL THEN 72
         WHEN p.last_verified_at < NOW() - (((($1)::int * 2))::text || ' days')::interval THEN 80
         ELSE 62
       END,
       'PENDING',
       NOW(),
       jsonb_build_object(
         'ttlDays', $1,
         'lastVerifiedAt', p.last_verified_at,
         'updatedAt', p.updated_at
       ),
       NOW()
     FROM places p
     WHERE p.status = 'PUBLISHED'
       AND COALESCE(p.last_verified_at, p.updated_at, p.created_at) <
           NOW() - ($1::text || ' days')::interval
     ON CONFLICT (place_id, reason)
     DO UPDATE SET
       priority = EXCLUDED.priority,
       status = CASE
         WHEN place_verification_queue.status = 'DISMISSED' THEN 'DISMISSED'
         ELSE 'PENDING'
       END,
       due_at = EXCLUDED.due_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`,
    [placeTtlDays]
  );

  await pool.query(
    `UPDATE place_verification_queue q
     SET status = 'DONE', updated_at = NOW()
     WHERE q.reason = 'MISSING_PHOTO'
       AND q.status = 'PENDING'
       AND EXISTS (
         SELECT 1 FROM place_images pi WHERE pi.place_id = q.place_id
       )`
  );

  await pool.query(
    `INSERT INTO place_verification_queue (
       place_id, reason, priority, status, due_at, metadata, updated_at
     )
     SELECT
       p.id,
       'MISSING_PHOTO',
       55,
       'PENDING',
       NOW(),
       jsonb_build_object('placeUpdatedAt', p.updated_at),
       NOW()
     FROM places p
     WHERE p.status = 'PUBLISHED'
       AND NOT EXISTS (
         SELECT 1 FROM place_images pi WHERE pi.place_id = p.id
       )
     ON CONFLICT (place_id, reason)
     DO UPDATE SET
       status = CASE
         WHEN place_verification_queue.status = 'DISMISSED' THEN 'DISMISSED'
         ELSE 'PENDING'
       END,
       due_at = EXCLUDED.due_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`
  );

  await pool.query(
    `UPDATE place_verification_queue q
     SET status = 'DONE', updated_at = NOW()
     FROM housing_listings hl
     WHERE q.place_id = hl.place_id
       AND q.reason = 'HOUSING_AVAILABILITY'
       AND q.status = 'PENDING'
       AND hl.last_verified_at IS NOT NULL
       AND hl.last_verified_at >= NOW() - ($1::text || ' days')::interval`,
    [String(housingTtlDays)]
  );

  await pool.query(
    `INSERT INTO place_verification_queue (
       place_id, reason, priority, status, due_at, metadata, updated_at
     )
     SELECT
       hl.place_id,
       'HOUSING_AVAILABILITY',
       CASE
         WHEN hl.availability_status = 'UNKNOWN' THEN 88
         WHEN hl.last_verified_at IS NULL THEN 85
         ELSE 78
       END,
       'PENDING',
       NOW(),
       jsonb_build_object(
         'ttlDays', $1,
         'availabilityStatus', hl.availability_status,
         'lastVerifiedAt', hl.last_verified_at,
         'availableRooms', hl.available_rooms
       ),
       NOW()
     FROM housing_listings hl
     JOIN places p ON p.id = hl.place_id
     WHERE p.status = 'PUBLISHED'
       AND (
         hl.last_verified_at IS NULL
         OR hl.last_verified_at < NOW() - ($1::text || ' days')::interval
       )
     ON CONFLICT (place_id, reason)
     DO UPDATE SET
       priority = EXCLUDED.priority,
       status = CASE
         WHEN place_verification_queue.status = 'DISMISSED' THEN 'DISMISSED'
         ELSE 'PENDING'
       END,
       due_at = EXCLUDED.due_at,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`,
    [housingTtlDays]
  );

  await syncPlaceSourceLinks();

  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'PENDING' AND reason = 'STALE_DATA')::int AS stale_data,
       COUNT(*) FILTER (WHERE status = 'PENDING' AND reason = 'MISSING_PHOTO')::int AS missing_photo,
       COUNT(*) FILTER (WHERE status = 'PENDING' AND reason = 'HOUSING_AVAILABILITY')::int AS housing
     FROM place_verification_queue`
  );

  const row = rows[0] || {};
  return {
    placeTtlDays,
    housingTtlDays,
    pending: Number(row.pending) || 0,
    staleData: Number(row.stale_data) || 0,
    missingPhoto: Number(row.missing_photo) || 0,
    housing: Number(row.housing) || 0
  };
}

export async function listIngestionSources() {
  const { rows } = await pool.query(
    'SELECT * FROM data_sources ORDER BY collection_mode, source_kind, id'
  );
  return rows.map(mapSource);
}

export async function updateIngestionSource(sourceKey, fields = {}, updatedBy = null) {
  const current = await getSourceByKey(sourceKey);
  const nextConfig = fields.config === undefined
    ? current.config
    : { ...(current.config || {}), ...(fields.config || {}) };

  const enabled = fields.enabled === undefined ? current.enabled : Boolean(fields.enabled);
  const scheduleMinutes = fields.scheduleMinutes === undefined
    ? current.schedule_minutes
    : fields.scheduleMinutes;
  const confidenceFloor = fields.confidenceFloor === undefined
    ? current.confidence_floor
    : fields.confidenceFloor;
  const autoPublishThreshold = fields.autoPublishThreshold === undefined
    ? current.auto_publish_threshold
    : fields.autoPublishThreshold;

  const nextRunAt = current.collection_mode === 'SCHEDULED' && enabled
    ? (fields.enabled === true && !current.enabled
        ? new Date(Date.now() + 60_000)
        : nextRunSql(scheduleMinutes || current.schedule_minutes))
    : null;

  const { rows } = await pool.query(
    `UPDATE data_sources
     SET enabled = $2,
         schedule_minutes = $3,
         confidence_floor = $4,
         auto_publish_threshold = $5,
         config = $6,
         next_run_at = $7,
         updated_by = $8,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      current.id,
      enabled,
      scheduleMinutes,
      confidenceFloor,
      autoPublishThreshold,
      JSON.stringify(nextConfig),
      nextRunAt,
      updatedBy || null
    ]
  );

  return mapSource(rows[0]);
}

async function getActiveJob(sourceId) {
  const { rows } = await pool.query(
    `SELECT ij.*, ds.source_key, ds.name AS source_name
     FROM ingestion_jobs ij
     JOIN data_sources ds ON ds.id = ij.source_id
     WHERE ij.source_id = $1
       AND ij.status = ANY($2::text[])
     ORDER BY ij.created_at DESC
     LIMIT 1`,
    [Number(sourceId), ACTIVE_JOB_STATUSES]
  );
  return mapJob(rows[0]);
}

export async function dispatchIngestionSource(sourceKey, {
  requestedBy = null,
  triggerType = 'MANUAL'
} = {}) {
  const source = await getSourceByKey(sourceKey);

  if (triggerType === 'SCHEDULE' && !source.enabled) return null;

  const active = await getActiveJob(source.id);
  if (active) return active;

  const inserted = await pool.query(
    `INSERT INTO ingestion_jobs (source_id, trigger_type, status, requested_by)
     VALUES ($1,$2,'QUEUED',$3)
     RETURNING *`,
    [source.id, triggerType, requestedBy || null]
  );
  const job = inserted.rows[0];

  const scheduleMinutes = source.schedule_minutes;
  const nextRunAt = source.collection_mode === 'SCHEDULED' && scheduleMinutes
    ? nextRunSql(scheduleMinutes)
    : null;

  await pool.query(
    `UPDATE data_sources
     SET last_run_at = NOW(),
         next_run_at = $2,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [source.id, nextRunAt]
  );

  try {
    if (source.source_key === 'OVERTURE_PLACES') {
      const run = await startOverturePlaceScan({
        startedBy: requestedBy,
        minConfidence: Number(source.confidence_floor ?? 0.65),
        mode: source.config?.mode || 'STAGING'
      });

      await updateJob(job.id, {
        status: 'DISPATCHED',
        underlyingKind: 'PLACE_IMPORT',
        underlyingRunId: run.id,
        startedAtNow: true
      });
    } else if (source.source_key === 'PHOTO_SCAN') {
      const run = await startPhotoScan({
        startedBy: requestedBy,
        scope: source.config?.scope || 'MISSING_IMAGES',
        limit: Math.min(Math.max(Number(source.config?.limit) || 60, 1), 200)
      });

      await updateJob(job.id, {
        status: 'DISPATCHED',
        underlyingKind: 'PHOTO_SCAN',
        underlyingRunId: run.id,
        startedAtNow: true
      });
    } else if (source.source_key === 'FRESHNESS_SWEEP') {
      await updateJob(job.id, { status: 'RUNNING', startedAtNow: true });
      const stats = await runFreshnessSweep(source.config || {});
      await updateJob(job.id, {
        status: 'SUCCESS',
        stats,
        finishedAtNow: true
      });
      await markSourceResult(source.id, {
        success: true,
        nextRunAt
      });
    } else {
      await updateJob(job.id, {
        status: 'SKIPPED',
        errorMessage: 'Nguồn sự kiện được cập nhật theo hoạt động người dùng/đối tác, không quét theo lịch.',
        finishedAtNow: true
      });
    }
  } catch (error) {
    const isBusy = Number(error?.status || error?.statusCode) === 409;
    await updateJob(job.id, {
      status: isBusy ? 'SKIPPED' : 'FAILED',
      errorMessage: String(error?.message || error).slice(0, 3000),
      finishedAtNow: true
    });
    await markSourceResult(source.id, {
      success: false,
      errorMessage: error?.message || error,
      nextRunAt: isBusy
        ? new Date(Date.now() + 30 * 60_000)
        : nextRunAt
    });
  }

  const { rows } = await pool.query(
    `SELECT ij.*, ds.source_key, ds.name AS source_name
     FROM ingestion_jobs ij
     JOIN data_sources ds ON ds.id = ij.source_id
     WHERE ij.id = $1`,
    [job.id]
  );
  return mapJob(rows[0]);
}

async function readUnderlyingRun(job) {
  if (!job.underlying_run_id || !job.underlying_kind) return null;

  if (job.underlying_kind === 'PLACE_IMPORT') {
    const { rows } = await pool.query(
      'SELECT * FROM place_import_runs WHERE id = $1 LIMIT 1',
      [job.underlying_run_id]
    );
    return rows[0] || null;
  }

  if (job.underlying_kind === 'PHOTO_SCAN') {
    const { rows } = await pool.query(
      'SELECT * FROM place_photo_scan_runs WHERE id = $1 LIMIT 1',
      [job.underlying_run_id]
    );
    return rows[0] || null;
  }

  return null;
}

function underlyingStats(kind, row) {
  if (!row) return {};

  if (kind === 'PLACE_IMPORT') {
    return {
      received: Number(row.received_count) || 0,
      staged: Number(row.staged_count) || 0,
      new: Number(row.new_count) || 0,
      review: Number(row.review_count) || 0,
      duplicates: Number(row.duplicate_count) || 0,
      skipped: Number(row.skipped_count) || 0
    };
  }

  return {
    scannedPlaces: Number(row.scanned_places_count) || 0,
    candidates: Number(row.candidate_count) || 0,
    skipped: Number(row.skipped_count) || 0
  };
}

export async function reconcileIngestionJobs() {
  const { rows: jobs } = await pool.query(
    `SELECT ij.*, ds.source_key, ds.name AS source_name,
            ds.auto_publish_threshold, ds.schedule_minutes, ds.config
     FROM ingestion_jobs ij
     JOIN data_sources ds ON ds.id = ij.source_id
     WHERE ij.status IN ('DISPATCHED','RUNNING')
     ORDER BY ij.created_at ASC
     LIMIT 20`
  );

  for (const job of jobs) {
    const run = await readUnderlyingRun(job);
    if (!run) {
      await updateJob(job.id, {
        status: 'FAILED',
        errorMessage: 'Không tìm thấy lượt quét nền tương ứng.',
        finishedAtNow: true
      });
      await markSourceResult(job.source_id, {
        success: false,
        errorMessage: 'Không tìm thấy lượt quét nền tương ứng.'
      });
      continue;
    }

    if (run.status === 'QUEUED' || run.status === 'RUNNING') {
      await updateJob(job.id, {
        status: run.status === 'RUNNING' ? 'RUNNING' : 'DISPATCHED',
        startedAtNow: run.status === 'RUNNING'
      });
      continue;
    }

    if (run.status === 'FAILED') {
      await updateJob(job.id, {
        status: 'FAILED',
        stats: underlyingStats(job.underlying_kind, run),
        errorMessage: run.error_message || 'Lượt quét nguồn thất bại.',
        finishedAtNow: true
      });
      await markSourceResult(job.source_id, {
        success: false,
        errorMessage: run.error_message || 'Lượt quét nguồn thất bại.',
        nextRunAt: nextRunSql(job.schedule_minutes)
      });
      continue;
    }

    const stats = underlyingStats(job.underlying_kind, run);

    if (run.status === 'SUCCESS' && job.source_key === 'OVERTURE_PLACES') {
      const threshold = Number(job.auto_publish_threshold);
      if (Number.isFinite(threshold)) {
        stats.autoPublish = await approveHighConfidenceImportedPlaces({
          reviewerId: null,
          minConfidence: threshold,
          limit: Math.min(Math.max(Number(job.config?.autoPublishLimit) || 200, 1), 200)
        });
      }
      await syncPlaceSourceLinks();
    }

    if (run.status === 'SUCCESS' && job.source_key === 'PHOTO_SCAN') {
      const shouldAutoApprove = job.config?.autoApproveLicensed !== false;
      const threshold = Number(job.auto_publish_threshold);
      if (shouldAutoApprove && Number.isFinite(threshold)) {
        stats.autoApprove = await autoApproveLicensedPhotos({
          threshold,
          limit: 100
        });
      }
    }

    await updateJob(job.id, {
      status: 'SUCCESS',
      stats,
      finishedAtNow: true
    });
    await markSourceResult(job.source_id, {
      success: true,
      nextRunAt: nextRunSql(job.schedule_minutes)
    });
  }
}

export async function dispatchDueIngestionSources() {
  await reconcileIngestionJobs();

  const { rows } = await pool.query(
    `SELECT *
     FROM data_sources
     WHERE enabled = TRUE
       AND collection_mode = 'SCHEDULED'
       AND source_key = ANY($1::text[])
       AND COALESCE(next_run_at, NOW()) <= NOW()
     ORDER BY next_run_at NULLS FIRST, id
     LIMIT 3`,
    [SCHEDULED_KEYS]
  );

  const dispatched = [];
  for (const source of rows) {
    const result = await dispatchIngestionSource(source.source_key, {
      requestedBy: null,
      triggerType: 'SCHEDULE'
    });
    if (result) dispatched.push(result);
  }
  return dispatched;
}

export async function dispatchAllIngestionSources({ requestedBy = null } = {}) {
  const results = [];
  for (const sourceKey of SCHEDULED_KEYS) {
    results.push(await dispatchIngestionSource(sourceKey, {
      requestedBy,
      triggerType: 'MANUAL'
    }));
  }
  return results.filter(Boolean);
}

export async function listIngestionJobs({ limit = 20 } = {}) {
  await reconcileIngestionJobs();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const { rows } = await pool.query(
    `SELECT ij.*, ds.source_key, ds.name AS source_name
     FROM ingestion_jobs ij
     JOIN data_sources ds ON ds.id = ij.source_id
     ORDER BY ij.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows.map(mapJob);
}

export async function getIngestionOverview() {
  await reconcileIngestionJobs();

  const [
    sources,
    jobs,
    placeStats,
    importStats,
    photoStats,
    queueStats,
    provenanceStats
  ] = await Promise.all([
    listIngestionSources(),
    listIngestionJobs({ limit: 12 }),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE p.status = 'PUBLISHED')::int AS published,
         COUNT(*) FILTER (
           WHERE p.status = 'PUBLISHED'
             AND NOT EXISTS (SELECT 1 FROM place_images pi WHERE pi.place_id = p.id)
         )::int AS missing_photos,
         COUNT(*) FILTER (
           WHERE p.status = 'PUBLISHED'
             AND COALESCE(p.last_verified_at, p.updated_at, p.created_at) < NOW() - INTERVAL '180 days'
         )::int AS stale_places
       FROM places p`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE import_status = 'NEW')::int AS new_count,
         COUNT(*) FILTER (WHERE import_status = 'REVIEW')::int AS review_count,
         COUNT(*) FILTER (WHERE import_status = 'DUPLICATE')::int AS duplicate_count,
         COUNT(*) FILTER (WHERE import_status = 'APPROVED')::int AS approved_count
       FROM imported_places
       WHERE source = 'OVERTURE'`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved
       FROM place_photo_candidates`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'PENDING' AND reason = 'STALE_DATA')::int AS stale_data,
         COUNT(*) FILTER (WHERE status = 'PENDING' AND reason = 'MISSING_PHOTO')::int AS missing_photo,
         COUNT(*) FILTER (WHERE status = 'PENDING' AND reason = 'HOUSING_AVAILABILITY')::int AS housing
       FROM place_verification_queue`
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(DISTINCT place_id)::int AS places
       FROM place_source_links`
    )
  ]);

  const p = placeStats.rows[0] || {};
  const i = importStats.rows[0] || {};
  const ph = photoStats.rows[0] || {};
  const q = queueStats.rows[0] || {};
  const prov = provenanceStats.rows[0] || {};

  return {
    sources,
    jobs,
    stats: {
      publishedPlaces: Number(p.published) || 0,
      missingPhotos: Number(p.missing_photos) || 0,
      stalePlaces: Number(p.stale_places) || 0,
      placeCandidatesNew: Number(i.new_count) || 0,
      placeCandidatesReview: Number(i.review_count) || 0,
      duplicateCandidates: Number(i.duplicate_count) || 0,
      importedApproved: Number(i.approved_count) || 0,
      photoCandidatesPending: Number(ph.pending) || 0,
      photoApproved: Number(ph.approved) || 0,
      verificationPending: Number(q.pending) || 0,
      verificationStaleData: Number(q.stale_data) || 0,
      verificationMissingPhoto: Number(q.missing_photo) || 0,
      verificationHousing: Number(q.housing) || 0,
      provenanceLinks: Number(prov.total) || 0,
      provenancePlaces: Number(prov.places) || 0
    }
  };
}
