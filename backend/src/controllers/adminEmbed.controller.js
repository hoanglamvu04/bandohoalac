import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listEmbedsAdmin,
  createApprovedEmbed,
  approveEmbed,
  rejectEmbed,
  revokeEmbed,
  rotateEmbed
} from '../services/embedPlatform.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

async function audit(req, action, item) {
  await writeAuditLog({
    actorUserId: req.user.id,
    action,
    entityType: 'EMBED_APPLICATION',
    entityId: item.id,
    metadata: {
      appName: item.appName,
      status: item.status,
      approvedOrigins: item.approvedOrigins
      // embedKey is PUBLIC but still omitted from audit logs.
    },
    ...auditContextFromRequest(req)
  });
}

export const getEmbedApplicationsAdmin = asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ items: await listEmbedsAdmin() });
});

export const createEmbedGrantAdmin = asyncHandler(async (req, res) => {
  const item = await createApprovedEmbed({ ...req.body, reviewedBy: req.user.id });
  await audit(req, 'EMBED_GRANT_CREATED', item);
  res.set('Cache-Control', 'private, no-store').status(201).json({ item });
});

export const approveEmbedRequestAdmin = asyncHandler(async (req, res) => {
  const item = await approveEmbed({
    id: Number(req.params.id),
    reviewedBy: req.user.id,
    ...req.body
  });
  await audit(req, 'EMBED_REQUEST_APPROVED', item);
  res.set('Cache-Control', 'private, no-store').json({ item });
});

export const rejectEmbedRequestAdmin = asyncHandler(async (req, res) => {
  const item = await rejectEmbed({
    id: Number(req.params.id),
    reviewedBy: req.user.id,
    ...req.body
  });
  await audit(req, 'EMBED_REQUEST_REJECTED', item);
  res.set('Cache-Control', 'private, no-store').json({ item });
});

export const revokeEmbedGrantAdmin = asyncHandler(async (req, res) => {
  const item = await revokeEmbed(Number(req.params.id), req.user.id);
  await audit(req, 'EMBED_GRANT_REVOKED', item);
  res.set('Cache-Control', 'private, no-store').json({ item });
});

export const rotateEmbedGrantAdmin = asyncHandler(async (req, res) => {
  const item = await rotateEmbed({
    id: Number(req.params.id),
    reviewedBy: req.user.id,
    ...req.body
  });
  await audit(req, 'EMBED_GRANT_ROTATED', item);
  res.set('Cache-Control', 'private, no-store').json({ item });
});
