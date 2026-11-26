import { z } from 'zod';
import { housingListQuerySchema } from './housing.validators.js';

const localPoint=z.tuple([z.number().finite().min(105.28).max(105.72),z.number().finite().min(20.86).max(21.18)]);
export const areaSearchSchema=z.object({points:z.array(localPoint).min(3).max(24),filters:housingListQuerySchema.optional()}).strict();
export const corridorSearchSchema=z.object({
 coordinates:z.array(localPoint).min(2).max(4000),
 distanceMeters:z.union([z.literal(200),z.literal(500),z.literal(1000)]),
 category:z.string().trim().regex(/^[a-z0-9-]{1,60}$/).optional()
}).strict();
export const areaSummarySchema=z.object({
 west:z.coerce.number().finite().min(105.28).max(105.72),
 east:z.coerce.number().finite().min(105.28).max(105.72),
 south:z.coerce.number().finite().min(20.86).max(21.18),
 north:z.coerce.number().finite().min(20.86).max(21.18)
}).strict().refine(b=>b.west<b.east&&b.south<b.north&&b.east-b.west<=0.15&&b.north-b.south<=0.15,'Chọn vùng nhỏ hơn.');
