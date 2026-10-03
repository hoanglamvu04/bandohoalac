import { asyncHandler } from '../utils/asyncHandler.js';
import { confirmRoadStatus } from '../services/roadStatus.service.js';

export const confirm = asyncHandler(async (req, res) => {
  const result = await confirmRoadStatus({
    contributionId: Number(req.params.id),
    userId: req.user.id,
    verdict: req.body.verdict
  });

  res.json(result);
});
