import { asyncHandler } from '../utils/asyncHandler.js';
import { getLeaderboard } from '../services/leaderboard.service.js';

export const getLeaderboardHandler = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const items = await getLeaderboard(limit);
  res.json({ items });
});
