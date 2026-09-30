import { z } from 'zod';

const statusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

function isAllowedTargetUrl(value) {
  if (value.startsWith('/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const targetUrlSchema = z.string()
  .trim()
  .min(1)
  .max(1200)
  .refine(isAllowedTargetUrl, 'targetUrl must be an internal path or an http/https URL.');

const nullableDateSchema = z.union([
  z.string().datetime({ offset: true }),
  z.null()
]);

const baseFields = {
  title: z.string().trim().min(2).max(160).optional(),
  targetUrl: targetUrlSchema.optional(),
  altText: z.string().trim().max(220).nullable().optional(),
  status: statusSchema.optional(),
  sortOrder: z.coerce.number().int().min(-9999).max(9999).optional(),
  startsAt: nullableDateSchema.optional(),
  endsAt: nullableDateSchema.optional()
};

function validateDateRange(data, ctx) {
  if (data.startsAt && data.endsAt && new Date(data.endsAt) < new Date(data.startsAt)) {
    ctx.addIssue({
      code: 'custom',
      message: 'endsAt must be after startsAt.',
      path: ['endsAt']
    });
  }
}

export const adminCreateAdvertisementSchema = z.object({
  ...baseFields,
  title: z.string().trim().min(2).max(160),
  targetUrl: targetUrlSchema
}).superRefine(validateDateRange);

export const adminUpdateAdvertisementSchema = z.object(baseFields)
  .superRefine(validateDateRange);
