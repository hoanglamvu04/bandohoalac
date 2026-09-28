import { z } from 'zod';

const numericString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a number');

export const nearbyQuerySchema = z.object({
  lat: numericString,
  lng: numericString,
  radius: numericString.optional(),
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional()
});

export const boundsQuerySchema = z.object({
  north: numericString,
  south: numericString,
  east: numericString,
  west: numericString,
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional()
});

export const listPlacesQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional(),
  status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED']).optional(),
  limit: numericString.optional(),
  offset: numericString.optional()
});
