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
  code: z.string().trim().min(6).max(80)
});
