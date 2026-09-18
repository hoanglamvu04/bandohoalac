import { z } from 'zod';

const CONTRIBUTION_TYPES = [
  'CREATE_PLACE', 'UPDATE_PLACE', 'ADD_PHOTO', 'FIX_LOCATION',
  'UPDATE_HOURS', 'UPDATE_PRICE', 'REPORT_CLOSED', 'REPORT_WRONG_INFO'
];

const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().nonnegative().optional(),
  timestamp: z.coerce.number().optional()
});

export const createContributionSchema = z.object({
  type: z.enum(CONTRIBUTION_TYPES),
  placeId: z.coerce.number().int().positive().optional(),
  location: locationSchema.optional(),
  place: z.object({
    name: z.string().trim().min(2).max(160).optional(),
    categorySlug: z.string().trim().max(80).optional(),
    address: z.string().trim().max(300).optional(),
    description: z.string().trim().max(2000).optional(),
    price: z.string().trim().max(120).optional(),
    openingHours: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    website: z.string().trim().max(200).optional()
  }).optional(),
  reason: z.string().trim().max(500).optional()
}).superRefine((data, ctx) => {
  if (data.type === 'CREATE_PLACE' || data.type === 'FIX_LOCATION') {
    if (!data.location) {
      ctx.addIssue({ code: 'custom', message: 'location is required for this contribution type.', path: ['location'] });
    }
  }
  if (data.type === 'CREATE_PLACE' && !data.place?.name) {
    ctx.addIssue({ code: 'custom', message: 'place.name is required to create a place.', path: ['place', 'name'] });
  }
  if (data.type !== 'CREATE_PLACE' && !data.placeId) {
    ctx.addIssue({ code: 'custom', message: 'placeId is required for this contribution type.', path: ['placeId'] });
  }
});
