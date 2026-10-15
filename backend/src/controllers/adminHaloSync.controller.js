import { asyncHandler } from '../utils/asyncHandler.js';
import { getHaloSyncMonitor } from '../services/haloSyncMonitor.service.js';

export const getHaloSyncMonitorAdmin = asyncHandler(async (req, res) => {
  const data = await getHaloSyncMonitor({ limit: Number(req.query.limit) || 30 });
  res.json(data);
});
