import { z } from 'zod';

const numericString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a number');

export const publicPlacesQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional(),
  limit: numericString.optional(),
  offset: numericString.optional()
});

export const publicBoundsQuerySchema = z.object({
  north: numericString,
  south: numericString,
  east: numericString,
  west: numericString,
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional()
}).superRefine((value, context) => {
  if (Number(value.north) <= Number(value.south)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['north'],
      message: 'north must be greater than south'
    });
  }

  if (Number(value.east) <= Number(value.west)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['east'],
      message: 'east must be greater than west'
    });
  }
});

export const publicNearbyQuerySchema = z.object({
  lat: numericString,
  lng: numericString,
  radius: numericString.optional(),
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional()
});
