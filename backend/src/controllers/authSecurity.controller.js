import { asyncHandler } from '../utils/asyncHandler.js';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { findUserById } from '../services/user.service.js';
import {
  clearRefreshCookie,
  getRecentSecurityEvents,
  listActiveSessions,
  recordSecurityEvent,
  revokeAllSessions,
  revokeSession
} from '../services/authSession.service.js';
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getAuthSecuritySummary,
  regenerateRecoveryCodes
} from '../services/userSecurity.service.js';

function context(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null
  };
}

async function requireCurrentPassword(userId, password) {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found.', 404);

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw new AppError('Mật khẩu hiện tại không đúng.', 401);
  return user;
}

export const securityOverview = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) throw new AppError('User not found.', 404);

  const [security, sessions, events] = await Promise.all([
    getAuthSecuritySummary(user),
    listActiveSessions(user.id, req.user.sessionId),
    getRecentSecurityEvents(user.id, 16)
  ]);

  res.json({
    security,
    sessions,
    events
  });
});

export const startTwoFactorSetup = asyncHandler(async (req, res) => {
  const user = await requireCurrentPassword(req.user.id, req.body.password);
  const setup = await beginTwoFactorSetup({
    user,
    sessionId: req.user.sessionId,
    ...context(req)
  });

  res.json(setup);
});

export const confirmTwoFactor = asyncHandler(async (req, res) => {
  const result = await confirmTwoFactorSetup({
    userId: req.user.id,
    sessionId: req.user.sessionId,
    code: req.body.code,
    ...context(req)
  });

  res.json({ ok: true, ...result });
});

export const regenerateTwoFactorRecoveryCodes = asyncHandler(async (req, res) => {
  await requireCurrentPassword(req.user.id, req.body.password);
  const result = await regenerateRecoveryCodes({
    userId: req.user.id,
    sessionId: req.user.sessionId,
    code: req.body.code,
    ...context(req)
  });

  res.json({ ok: true, ...result });
});

export const removeTwoFactor = asyncHandler(async (req, res) => {
  await requireCurrentPassword(req.user.id, req.body.password);
  await disableTwoFactor({
    userId: req.user.id,
    sessionId: req.user.sessionId,
    code: req.body.code,
    recoveryCode: req.body.recoveryCode,
    ...context(req)
  });

  res.json({ ok: true });
});

export const revokeSecuritySession = asyncHandler(async (req, res) => {
  const sessionId = String(req.params.sessionId || '');
  const revoked = await revokeSession({
    userId: req.user.id,
    sessionId,
    reason: 'USER_REVOKED'
  });

  if (!revoked) throw new AppError('Không tìm thấy phiên đăng nhập.', 404);

  await recordSecurityEvent({
    userId: req.user.id,
    sessionId,
    type: 'SESSION_REVOKED',
    severity: 'WARN',
    ...context(req)
  });

  if (sessionId === String(req.user.sessionId)) {
    clearRefreshCookie(res);
  }

  res.json({ ok: true, currentSessionRevoked: sessionId === String(req.user.sessionId) });
});

export const revokeAllSecuritySessions = asyncHandler(async (req, res) => {
  const count = await revokeAllSessions({
    userId: req.user.id,
    reason: 'USER_REVOKED_ALL'
  });

  clearRefreshCookie(res);

  await recordSecurityEvent({
    userId: req.user.id,
    sessionId: req.user.sessionId,
    type: 'ALL_SESSIONS_REVOKED',
    severity: 'CRITICAL',
    ...context(req),
    metadata: { count }
  });

  res.json({ ok: true, revokedCount: count });
});


export const changePassword = asyncHandler(async (req, res) => {
  const user = await requireCurrentPassword(req.user.id, req.body.currentPassword);
  const passwordHash = await hashPassword(req.body.newPassword);

  await pool.query(
    'UPDATE users SET password_hash = $2 WHERE id = $1',
    [user.id, passwordHash]
  );

  const count = await revokeAllSessions({
    userId: user.id,
    reason: 'PASSWORD_CHANGED'
  });
  clearRefreshCookie(res);

  await recordSecurityEvent({
    userId: user.id,
    sessionId: req.user.sessionId,
    type: 'PASSWORD_CHANGED',
    severity: 'CRITICAL',
    ...context(req),
    metadata: { revokedSessions: count }
  });

  res.json({ ok: true, logoutRequired: true });
});
