import { z } from 'zod';

export const placeEngagementEventSchema = z.object({
  eventType: z.enum(['VIEW', 'CALL', 'DIRECTIONS', 'WEBSITE'])
}).strict();

export const partnerAnalyticsQuerySchema = z.object({
  days: z.enum(['7', '30', '90']).default('30'),
  placeId: z.string().regex(/^[1-9]\d{0,14}$/).optional()
}).strict();
