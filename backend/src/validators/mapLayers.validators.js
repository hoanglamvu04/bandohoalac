import { z } from 'zod';

const layerType = z.enum([
  'ROAD', 'TERRAIN', 'WATER', 'BUILDING', 'LANDMARK',
  'FLOOD', 'ROAD_CLOSURE', 'ALERT', 'PLANNING', 'EVENT'
]);

const severity = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).nullable().optional();

const geometry = z.object({
  type: z.enum(['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']),
  coordinates: z.any()
});

export const createMapFeatureSchema = z.object({
  layerType,
  name: z.string().trim().max(200).optional(),
  geometry,
  properties: z.record(z.any()).optional(),
  severity,
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional()
});

export const updateMapFeatureSchema = createMapFeatureSchema.partial();
