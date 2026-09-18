import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createUser, findUserByEmail, findUserById, toPublicUser } from '../services/user.service.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, passwordHash, role: 'USER' });
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.status(201).json({ token, user: toPublicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.json({ token, user: toPublicUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) throw new AppError('User not found.', 404);
  res.json({ user: toPublicUser(user) });
});
