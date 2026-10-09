import { asyncHandler } from '../utils/asyncHandler.js';
import {
  approvePhotoCandidate,
  getPhotoScannerStats,
  listPhotoCandidates,
  listPhotoScanRuns,
  rejectPhotoCandidate,
  startPhotoScan
} from '../services/photoScanner.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const listPhotoCandidatesAdmin = asyncHandler(async (req, res) => {
  const items = await listPhotoCandidates({
    status: req.query.status || 'PENDING',
    source: req.query.source || 'ALL',
    q: req.query.q,
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.json({ items });
});

export const getPhotoScannerStatsAdmin = asyncHandler(async (_req, res) => {
  res.json(await getPhotoScannerStats());
});

export const listPhotoScanRunsAdmin = asyncHandler(async (req, res) => {
  const items = await listPhotoScanRuns({ limit: req.query.limit });
  res.json({ items });
});

export const startPhotoScanAdmin = asyncHandler(async (req, res) => {
  const run = await startPhotoScan({
    startedBy: req.user.id,
    scope: req.body?.scope || 'MISSING_IMAGES',
    limit: req.body?.limit ?? 50
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_PHOTO_SCAN_START',
    entityType: 'PLACE_PHOTO_SCAN_RUN',
    entityId: run.id,
    metadata: {
      scope: run.scope,
      requestedLimit: run.requestedLimit,
      providers: run.providers
    },
    ...auditContextFromRequest(req)
  });

  res.status(202).json({ run });
});

export const approvePhotoCandidateAdmin = asyncHandler(async (req, res) => {
  const result = await approvePhotoCandidate(req.params.id, req.user.id, {
    makeCover: req.body?.makeCover !== false
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_PHOTO_CANDIDATE_APPROVE',
    entityType: 'PLACE_PHOTO_CANDIDATE',
    entityId: req.params.id,
    metadata: {
      imageId: result.imageId,
      isCover: result.isCover ?? null,
      source: result.candidate?.source || null
    },
    ...auditContextFromRequest(req)
  });

  res.status(result.alreadyApproved ? 200 : 201).json(result);
});

export const rejectPhotoCandidateAdmin = asyncHandler(async (req, res) => {
  const item = await rejectPhotoCandidate(req.params.id, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_PHOTO_CANDIDATE_REJECT',
    entityType: 'PLACE_PHOTO_CANDIDATE',
    entityId: req.params.id,
    metadata: { source: item.source },
    ...auditContextFromRequest(req)
  });

  res.json({ ok: true, item });
});
