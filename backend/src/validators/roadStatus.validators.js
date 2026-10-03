import { z } from 'zod';

export const roadStatusConfirmationSchema = z.object({
  verdict: z.enum(['STILL_ACTIVE', 'RESOLVED'])
});
