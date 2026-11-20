import { asyncHandler } from '../utils/asyncHandler.js';
import { listMyPropertyListings, managePropertyListing } from '../services/housingLifecycle.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

export const listMyHousing = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ items: await listMyPropertyListings(req.user.id) });
});

export const manageMyHousing = asyncHandler(async (req, res) => {
  const result = await managePropertyListing(Number(req.params.placeId), req.user, req.body.action);
  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'HOUSING_LISTING_' + req.body.action,
    entityType: 'PLACE',
    entityId: Number(req.params.placeId),
    metadata: { listingStatus: result.listingStatus },
    ...auditContextFromRequest(req)
  });
  res.set('Cache-Control', 'no-store');
  res.json(result);
});
