import { z } from 'zod';

const title = z.string().trim().min(2).max(100);
const description = z.string().trim().max(500);
const visibility = z.enum(['PRIVATE', 'PUBLIC']);

export const createCollectionSchema = z.object({
  title,
  description: description.optional().default(''),
  visibility: visibility.optional().default('PRIVATE')
});

export const updateCollectionSchema = z.object({
  title: title.optional(),
  description: description.optional(),
  visibility: visibility.optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Cần ít nhất một trường để cập nhật.'
});

export const addCollectionPlaceSchema = z.object({
  placeId: z.coerce.number().int().positive()
});

export const replaceCollectionPlacesSchema = z.object({
  placeIds: z.array(z.coerce.number().int().positive()).max(100)
}).superRefine((data, ctx) => {
  if (new Set(data.placeIds).size !== data.placeIds.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Một địa điểm không thể xuất hiện hai lần trong bộ sưu tập.',
      path: ['placeIds']
    });
  }
});
