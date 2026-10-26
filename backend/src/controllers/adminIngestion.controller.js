import { asyncHandler } from '../utils/asyncHandler.js';
import {
  dispatchAllIngestionSources,
  dispatchIngestionSource,
  getIngestionOverview,
  listIngestionJobs,
  listIngestionSources,
  runFreshnessSweep,
  updateIngestionSource
} from '../services/ingestion.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const getIngestionOverviewAdmin = asyncHandler(async (_req, res) => {
  res.json(await getIngestionOverview());
});

export const listIngestionSourcesAdmin = asyncHandler(async (_req, res) => {
  res.json({ items: await listIngestionSources() });
});

export const listIngestionJobsAdmin = asyncHandler(async (req, res) => {
  res.json({ items: await listIngestionJobs({ limit: req.query.limit }) });
});

export const updateIngestionSourceAdmin = asyncHandler(async (req, res) => {
  const source = await updateIngestionSource(req.params.key, req.body, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'INGESTION_SOURCE_UPDATE',
    entityType: 'DATA_SOURCE',
    entityId: source.id,
    metadata: {
      sourceKey: source.key,
      enabled: source.enabled,
      scheduleMinutes: source.scheduleMinutes,
      autoPublishThreshold: source.autoPublishThreshold
    },
    ...auditContextFromRequest(req)
  });

  res.json({ ok: true, source });
});

export const runIngestionSourceAdmin = asyncHandler(async (req, res) => {
  const job = await dispatchIngestionSource(req.params.key, {
    requestedBy: req.user.id,
    triggerType: 'MANUAL'
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'INGESTION_SOURCE_RUN',
    entityType: 'INGESTION_JOB',
    entityId: job?.id || null,
    metadata: {
      sourceKey: String(req.params.key || '').toUpperCase(),
      status: job?.status || null
    },
    ...auditContextFromRequest(req)
  });

  res.status(202).json({ job });
});

export const runAllIngestionAdmin = asyncHandler(async (req, res) => {
  const jobs = await dispatchAllIngestionSources({ requestedBy: req.user.id });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'INGESTION_FULL_CYCLE_RUN',
    entityType: 'INGESTION_JOB_BATCH',
    metadata: {
      jobIds: jobs.map((job) => job.id),
      sourceKeys: jobs.map((job) => job.sourceKey)
    },
    ...auditContextFromRequest(req)
  });

  res.status(202).json({ jobs });
});

export const runFreshnessSweepAdmin = asyncHandler(async (req, res) => {
  const stats = await runFreshnessSweep(req.body || {});

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'INGESTION_FRESHNESS_SWEEP',
    entityType: 'VERIFICATION_QUEUE',
    metadata: stats,
    ...auditContextFromRequest(req)
  });

  res.json({ ok: true, stats });
});
