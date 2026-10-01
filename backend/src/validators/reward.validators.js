import { z } from 'zod';

const nullableDate = z.union([z.string().datetime({ offset: true }), z.null()]);

export const adminCreatePartnerSchema = z.object({
  placeId: z.coerce.number().int().positive(),
  status: z.enum(['PENDING', 'ACTIVE', 'PAUSED', 'ENDED']).default('PENDING'),
  partnerName: z.string().trim().max(160).nullable().optional(),
  contactName: z.string().trim().max(160).nullable().optional(),
  contactPhone: z.string().trim().max(60).nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
  note: z.string().trim().max(1200).nullable().optional()
});

export const adminUpdatePartnerSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'PAUSED', 'ENDED']).optional(),
  partnerName: z.string().trim().max(160).nullable().optional(),
  contactName: z.string().trim().max(160).nullable().optional(),
  contactPhone: z.string().trim().max(60).nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
  note: z.string().trim().max(1200).nullable().optional()
});

const voucherFields = {
  partnerId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  voucherValueText: z.string().trim().max(180).nullable().optional(),
  voucherValueAmount: z.union([z.coerce.number().int().min(1).max(1000000000), z.null()]).optional(),
  terms: z.string().trim().max(2400).nullable().optional(),
  pointsCost: z.coerce.number().int().min(1).max(1000000).optional(),
  quantityTotal: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  maxPerUser: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']).optional(),
  startsAt: nullableDate.optional(),
  endsAt: nullableDate.optional()
};

function checkDates(data, ctx) {
  if (data.startsAt && data.endsAt && new Date(data.endsAt) < new Date(data.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt must be after startsAt.' });
  }
}

export const adminCreateVoucherSchema = z.object({
  ...voucherFields,
  partnerId: z.coerce.number().int().positive(),
  title: z.string().trim().min(2).max(180),
  pointsCost: z.coerce.number().int().min(1).max(1000000)
}).superRefine(checkDates);

export const adminUpdateVoucherSchema = z.object(voucherFields).superRefine(checkDates);


export const adminCreateSettlementSchema = z.object({
  partnerId: z.coerce.number().int().positive(),
  note: z.string().trim().max(500).nullable().optional()
});
