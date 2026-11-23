import { z } from 'zod';

export const rejectContributionSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export const propertyRiskQueueSchema = z.object({
  limit: z.string().regex(/^(?:[1-9]|10)$/).default('10'),
  offset: z.string().regex(/^(?:0|[1-9]\d{0,2})$/).default('0')
}).strict();
