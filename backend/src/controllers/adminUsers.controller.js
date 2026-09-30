import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  adjustUserWallet,
  getAdminUser,
  listAdminUsers,
  updateAdminUser
} from '../services/adminUser.service.js';

export const listUsersAdmin = asyncHandler(async (req, res) => {
  const items = await listAdminUsers({
    q: req.query.q,
    role: req.query.role || 'ALL',
    accountStatus: req.query.accountStatus || 'ALL',
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0
  });

  res.json({ items });
});

export const getUserAdmin = asyncHandler(async (req, res) => {
  const item = await getAdminUser(Number(req.params.id));
  if (!item) throw new AppError('User not found.', 404);
  res.json(item);
});

export const updateUserAdmin = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  if (Number(req.user.id) === userId) {
    if (req.body.role && req.body.role !== 'ADMIN') {
      throw new AppError('Bạn không thể tự hạ quyền tài khoản Admin đang đăng nhập.', 400);
    }

    if (req.body.accountStatus && req.body.accountStatus !== 'ACTIVE') {
      throw new AppError('Bạn không thể tự khóa tài khoản Admin đang đăng nhập.', 400);
    }
  }

  const existing = await getAdminUser(userId);
  if (!existing) throw new AppError('User not found.', 404);

  const item = await updateAdminUser(userId, req.body);
  res.json(item);
});

export const adjustUserWalletAdmin = asyncHandler(async (req, res) => {
  const item = await adjustUserWallet({
    userId: Number(req.params.id),
    amount: req.body.amount,
    reason: req.body.reason,
    adminId: req.user.id
  });

  res.json(item);
});
