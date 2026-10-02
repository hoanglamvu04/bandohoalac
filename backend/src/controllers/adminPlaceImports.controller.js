import { asyncHandler } from '../utils/asyncHandler.js';
import {
  approveHighConfidenceImportedPlaces,
  approveImportedPlace,
  getImportedPlacesStats,
  listImportedPlaces,
  rejectImportedPlace,
  updateImportedPlace
} from '../services/placeImport.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const listPlaceImportsAdmin = asyncHandler(async (req, res) => {
  const [items, stats] = await Promise.all([
    listImportedPlaces({
      q: req.query.q,
      status: req.query.status || 'ALL',
      minConfidence: req.query.minConfidence,
      limit: req.query.limit,
      offset: req.query.offset
    }),
    getImportedPlacesStats()
  ]);

  res.json({ items, stats });
});

export const getPlaceImportStatsAdmin = asyncHandler(async (_req, res) => {
  res.json(await getImportedPlacesStats());
});

export const updatePlaceImportAdmin = asyncHandler(async (req, res) => {
  const item = await updateImportedPlace(req.params.id, {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone,
    website: req.body.website,
    mappedCategorySlug: req.body.mappedCategorySlug
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_IMPORT_UPDATE',
    entityType: 'IMPORTED_PLACE',
    entityId: req.params.id,
    metadata: {
      mappedCategorySlug: req.body.mappedCategorySlug || null
    },
    ...auditContextFromRequest(req)
  });

  res.json({ ok: true, item });
});

export const approvePlaceImportAdmin = asyncHandler(async (req, res) => {
  const result = await approveImportedPlace(req.params.id, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_IMPORT_APPROVE',
    entityType: 'IMPORTED_PLACE',
    entityId: req.params.id,
    metadata: { placeId: result.placeId },
    ...auditContextFromRequest(req)
  });

  res.status(result.alreadyApproved ? 200 : 201).json(result);
});

export const rejectPlaceImportAdmin = asyncHandler(async (req, res) => {
  const result = await rejectImportedPlace(req.params.id, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_IMPORT_REJECT',
    entityType: 'IMPORTED_PLACE',
    entityId: req.params.id,
    ...auditContextFromRequest(req)
  });

  res.json(result);
});

export const approveHighConfidencePlaceImportsAdmin = asyncHandler(async (req, res) => {
  const result = await approveHighConfidenceImportedPlaces({
    reviewerId: req.user.id,
    minConfidence: req.body.minConfidence ?? 0.8,
    limit: req.body.limit ?? 200
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'PLACE_IMPORT_BULK_APPROVE',
    entityType: 'IMPORTED_PLACE_BATCH',
    metadata: {
      threshold: result.threshold,
      approvedCount: result.approvedCount,
      failedCount: result.failedCount
    },
    ...auditContextFromRequest(req)
  });

  res.json(result);
});
