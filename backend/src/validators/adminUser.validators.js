import { z } from 'zod';

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  role: z.enum(['USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN']).optional(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED']).optional()
});

export const adminAdjustWalletSchema = z.object({
  amount: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0, {
    message: 'Amount must not be zero.'
  }),
  reason: z.string().trim().min(3).max(220)
});
