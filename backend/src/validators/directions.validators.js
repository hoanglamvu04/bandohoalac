import { z } from 'zod';
import { isInsideServiceCoverage } from '../config/mapCoverage.js';

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const directionsQuerySchema = z.object({
  originLat: latitude,
  originLng: longitude,
  destinationLat: latitude,
  destinationLng: longitude,
  profile: z.enum(['driving']).optional()
}).superRefine((data, ctx) => {
  if (!isInsideServiceCoverage(data.destinationLng, data.destinationLat)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Destination is outside the Hola Maps service area.',
      path: ['destinationLat']
    });
  }
});


const tripStopSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().max(160).optional(),
  lat: latitude,
  lng: longitude
});

export const tripDirectionsBodySchema = z.object({
  stops: z.array(tripStopSchema).min(2).max(12),
  optimize: z.boolean().optional().default(false),
  profile: z.enum(['driving']).optional().default('driving')
}).superRefine((data, ctx) => {
  data.stops.forEach((stop, index) => {
    if (!isInsideServiceCoverage(stop.lng, stop.lat)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Trip stops must be inside the Hola Maps service area.',
        path: ['stops', index, 'lat']
      });
    }
  });

  const ids = data.stops.map((stop) => stop.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'A place can only be added once to a trip.',
      path: ['stops']
    });
  }
});
