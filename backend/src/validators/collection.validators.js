import { z } from 'zod';

const visibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);

export const createCollectionSchema = z.object({
  title: z.string().trim().min(2, 'Tên bộ sưu tập cần ít nhất 2 ký tự.').max(100),
  description: z.string().trim().max(1000).optional().default(''),
  visibility: visibilitySchema.default('PRIVATE')
});

export const updateCollectionSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  visibility: visibilitySchema.optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Cần ít nhất một thông tin để cập nhật.'
});

export const addCollectionItemSchema = z.object({
  placeId: z.coerce.number().int().positive()
});
