import { z } from 'zod';

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  role: z.enum(['USER', 'CONTRIBUTOR', 'CTV', 'MODERATOR', 'ADMIN']).optional(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  ctvLevel: z.coerce.number().int().min(1).max(2).optional(),
  ctvTrustScore: z.coerce.number().int().min(0).max(100).optional()
});

export const adminAdjustWalletSchema = z.object({
  amount: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0, {
    message: 'Amount must not be zero.'
  }),
  reason: z.string().trim().min(3).max(220)
});

export const adminAssignPartnerAccessSchema = z.object({
  partnerId: z.coerce.number().int().positive(),
  role: z.enum(['OWNER', 'STAFF'])
});

export const adminUpdatePartnerAccessSchema = z.object({
  role: z.enum(['OWNER', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
}).refine((value) => value.role || value.status, {
  message: 'At least one partner access field is required.'
});

export const adminReputationControlSchema = z.object({
  scoreAdjustment: z.coerce.number().int().min(-15).max(15).optional(),
  permissionCeiling: z.enum([
    'NEW_MEMBER',
    'EXPLORER',
    'CONTRIBUTOR',
    'TRUSTED_CONTRIBUTOR',
    'LOCAL_EXPERT'
  ]).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().min(5).max(500),
  clear: z.boolean().optional().default(false)
}).refine((value) => (
  value.clear
  || value.scoreAdjustment !== undefined
  || value.permissionCeiling !== undefined
  || value.expiresAt !== undefined
), {
  message: 'Cần có ít nhất một thay đổi Reputation hoặc chọn clear.'
});
