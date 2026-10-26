import { z } from 'zod';

export const updateIngestionSourceSchema = z.object({
  enabled: z.boolean().optional(),
  scheduleMinutes: z.number().int().min(5).max(10080).nullable().optional(),
  confidenceFloor: z.number().min(0).max(1).nullable().optional(),
  autoPublishThreshold: z.number().min(0).max(1).nullable().optional(),
  config: z.record(z.any()).optional()
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Cần ít nhất một thay đổi.' }
);
