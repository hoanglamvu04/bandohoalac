import { z } from 'zod';

export const googlePlaceImportPreviewSchema = z.object({
  input: z.string().trim().min(2).max(1200)
});
