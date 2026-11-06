import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listAdminLocalSeoPages,
  updateLocalSeoPageStatus
} from '../services/localSeo.service.js';

export const getAdminLocalSeoPages = asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ items: await listAdminLocalSeoPages() });
});

export const updateAdminLocalSeoPageStatus = asyncHandler(async (req, res) => {
  const item = await updateLocalSeoPageStatus(
    Number(req.params.id),
    req.body.status,
    req.user.id
  );
  res.set('Cache-Control', 'private, no-store');
  res.json({ item });
});
