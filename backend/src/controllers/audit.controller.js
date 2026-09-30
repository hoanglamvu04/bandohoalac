import { asyncHandler } from '../utils/asyncHandler.js';
import { listAuditLogs } from '../services/audit.service.js';

export const listAuditLogsAdmin = asyncHandler(async (req, res) => {
  const items = await listAuditLogs({
    q: req.query.q,
    action: req.query.action || 'ALL',
    entityType: req.query.entityType || 'ALL',
    limit: Number(req.query.limit) || 100,
    offset: Number(req.query.offset) || 0
  });

  res.json({ items });
});
