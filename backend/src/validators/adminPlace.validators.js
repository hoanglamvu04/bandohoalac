import { z } from 'zod';
import { isInsideServiceCoverage } from '../config/mapCoverage.js';

const placeFields = {
  name: z.string().trim().min(2).max(160).optional(),
  categorySlug: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  priceLevel: z.string().trim().max(120).nullable().optional(),
  openingHours: z.string().trim().max(120).nullable().optional(),
  status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
};

export const adminCreatePlaceSchema = z.object({
  ...placeFields,
  name: z.string().trim().min(2).max(160),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
}).superRefine((data, ctx) => {
  if (!isInsideServiceCoverage(data.lng, data.lat)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Location is outside the Hola Maps service area.',
      path: ['lat']
    });
  }
});

export const adminUpdatePlaceSchema = z.object(placeFields).superRefine((data, ctx) => {
  const hasLat = data.lat !== undefined;
  const hasLng = data.lng !== undefined;

  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: 'custom',
      message: 'lat and lng must be updated together.',
      path: ['lat']
    });
  }

  if (hasLat && hasLng && !isInsideServiceCoverage(data.lng, data.lat)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Location is outside the Hola Maps service area.',
      path: ['lat']
    });
  }
});
