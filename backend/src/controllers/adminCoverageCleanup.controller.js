import { asyncHandler } from '../utils/asyncHandler.js';
import {
  archiveOutsideCoveragePlaces,
  getOutsideCoverageSummary
} from '../services/coverageCleanup.service.js';

export const getCoverageCleanupAdmin = asyncHandler(async (req, res) => {
  const result = await getOutsideCoverageSummary({ limit: req.query.limit });
  res.json(result);
});

export const runCoverageCleanupAdmin = asyncHandler(async (req, res) => {
  const result = await archiveOutsideCoveragePlaces();
  res.json({
    ok: true,
    ...result,
    message: result.archived
      ? `Đã ẩn ${result.archived} địa điểm nằm ngoài 9 xã phục vụ.`
      : 'Không còn địa điểm nào nằm ngoài vùng phục vụ.'
  });
});
