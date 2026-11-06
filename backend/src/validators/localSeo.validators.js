import { z } from 'zod';

export const updateLocalSeoPageStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
});
