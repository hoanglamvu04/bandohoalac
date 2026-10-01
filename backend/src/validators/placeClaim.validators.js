import { z } from 'zod';

export const createPlaceClaimSchema = z.object({
  placeId: z.coerce.number().int().positive(),
  businessName: z.string().trim().min(2).max(180).optional(),
  contactPhone: z.string().trim().min(5).max(60),
  proofNote: z.string().trim().min(10).max(2000)
});

export const reviewPlaceClaimSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(1200).nullable().optional()
});

export const partnerRedeemCodeSchema = z.object({
  code: z.string().trim().min(6).max(180),
  qrToken: z.string().trim().min(12).max(120).nullable().optional()
});

export const partnerVoucherInspectSchema = z.object({
  code: z.string().trim().min(6).max(180),
  qrToken: z.string().trim().min(12).max(120).nullable().optional()
});

export const partnerVoucherUseSchema = z.object({
  code: z.string().trim().min(6).max(180).nullable().optional(),
  qrToken: z.string().trim().min(12).max(120).nullable().optional()
});

export const partnerStaffCreateSchema = z.object({
  partnerId: z.coerce.number().int().positive(),
  email: z.string().trim().email().max(255)
});

export const partnerStaffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'])
});


export const partnerUpdatePlaceSchema = z.object({
  phone: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  openingHours: z.string().trim().max(1000).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional()
});
