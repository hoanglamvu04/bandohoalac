import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  adjustUserWallet,
  assignAdminUserPartnerAccess,
  getAdminUser,
  listAdminUsers,
  updateAdminUser,
  updateAdminUserPartnerAccess
} from '../services/adminUser.service.js';
import { updateReputationControl } from '../services/reputation.service.js';
import { auditContextFromRequest, writeAuditLog } from '../services/audit.service.js';

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

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'ADMIN_USER_UPDATED',
    entityType: 'USER',
    entityId: userId,
    metadata: { before: existing, changes: req.body },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});

export const adjustUserWalletAdmin = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const item = await adjustUserWallet({
    userId,
    amount: req.body.amount,
    reason: req.body.reason,
    adminId: req.user.id
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'ADMIN_WALLET_ADJUSTED',
    entityType: 'USER',
    entityId: userId,
    metadata: {
      amount: req.body.amount,
      reason: req.body.reason,
      nextBalance: item.pointsBalance
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});

export const updateUserReputationControlAdmin = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const existing = await getAdminUser(userId);
  if (!existing) throw new AppError('User not found.', 404);

  if (
    Number(req.user.id) === userId
    && !req.body.clear
    && Number(req.body.scoreAdjustment || 0) > 0
  ) {
    throw new AppError('Admin không thể tự cộng điểm Reputation cho chính mình.', 400);
  }

  const result = await updateReputationControl({
    userId,
    adminId: req.user.id,
    scoreAdjustment: req.body.scoreAdjustment ?? 0,
    permissionCeiling: req.body.permissionCeiling ?? null,
    expiresAt: req.body.expiresAt ?? null,
    reason: req.body.reason,
    clear: Boolean(req.body.clear)
  });
  if (!result) throw new AppError('User not found.', 404);

  const item = await getAdminUser(userId);

  await writeAuditLog({
    actorUserId: req.user.id,
    action: req.body.clear ? 'ADMIN_REPUTATION_CONTROL_CLEARED' : 'ADMIN_REPUTATION_CONTROL_UPDATED',
    entityType: 'USER',
    entityId: userId,
    metadata: {
      before: existing.reputationInspector?.reputation || null,
      after: result.reputation,
      control: result.control,
      reason: req.body.reason
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});

export const assignPartnerAccessAdmin = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const existing = await getAdminUser(userId);
  if (!existing) throw new AppError('User not found.', 404);

  const item = await assignAdminUserPartnerAccess({
    userId,
    partnerId: Number(req.body.partnerId),
    role: req.body.role,
    adminId: req.user.id
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'ADMIN_PARTNER_ACCESS_ASSIGNED',
    entityType: 'USER',
    entityId: userId,
    metadata: {
      partnerId: Number(req.body.partnerId),
      role: req.body.role
    },
    ...auditContextFromRequest(req)
  });

  res.status(201).json(item);
});

export const updatePartnerAccessAdmin = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const item = await updateAdminUserPartnerAccess({
    userId,
    membershipId: Number(req.params.membershipId),
    role: req.body.role,
    status: req.body.status
  });

  await writeAuditLog({
    actorUserId: req.user.id,
    action: 'ADMIN_PARTNER_ACCESS_UPDATED',
    entityType: 'USER',
    entityId: userId,
    metadata: {
      membershipId: Number(req.params.membershipId),
      ...req.body
    },
    ...auditContextFromRequest(req)
  });

  res.json(item);
});
