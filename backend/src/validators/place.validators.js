import { z } from 'zod';

const numericString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a number');

export const nearbyQuerySchema = z.object({
  lat: numericString,
  lng: numericString,
  radius: numericString.optional(),
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional(),
  limit: numericString.optional(),
  offset: numericString.optional()
});

export const travelTimeQuerySchema = z.object({
  anchor: z.enum(['fpt', 'dhqg', 'cnc']).default('fpt'),
  minutes: z.enum(['5', '10', '15']).default('10'),
  category: z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),
  limit: z.string().regex(/^(?:[1-9]|1[0-9]|20)$/).optional()
}).strict();

export const boundsQuerySchema = z.object({
  north: numericString,
  south: numericString,
  east: numericString,
  west: numericString,
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional(),
  limit: numericString.optional(),
  offset: numericString.optional()
});

export const listPlacesQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).optional(),
  minRating: numericString.optional(),
  status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED']).optional(),
  limit: numericString.optional(),
  offset: numericString.optional()
});
