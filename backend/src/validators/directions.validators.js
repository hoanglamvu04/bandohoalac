import { z } from 'zod';

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const directionsQuerySchema = z.object({
  originLat: latitude,
  originLng: longitude,
  destinationLat: latitude,
  destinationLng: longitude,
  profile: z.enum(['driving']).optional()
});
