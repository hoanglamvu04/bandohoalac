import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createMission,
  listMissionsAdmin,
  listPublicMissions,
  updateMission
} from '../services/mission.service.js';
import {
  auditContextFromRequest,
  writeAuditLog
} from '../services/audit.service.js';

export const listMissions = asyncHandler(async (req, res) => {
  const items = await listPublicMissions(req.user?.id || null);
  res.json({ items });
});

export const listMissionsAdminController = asyncHandler(async (req, res) => {
  const items = await listMissionsAdmin({
    status: req.query.status || 'ALL'
  });
  res.json({ items });
});

export const createMissionAdminController = asyncHandler(async (req, res) => {
  const item = await createMission(req.body, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'MISSION_CREATED',
    entityType: 'MISSION',
    entityId: item.id,
    metadata: { title: item.title, status: item.status },
    ...auditContextFromRequest(req)
  });

  res.status(201).json(item);
});

export const updateMissionAdminController = asyncHandler(async (req, res) => {
  const item = await updateMission(Number(req.params.id), req.body, req.user.id);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'MISSION_UPDATED',
    entityType: 'MISSION',
    entityId: item.id,
    metadata: req.body,
    ...auditContextFromRequest(req)
  });

  res.json(item);
});
