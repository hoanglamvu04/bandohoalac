import { z } from 'zod';

export const rejectContributionSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});
