import { z } from 'zod';

const numericString = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a non-negative number');
const booleanString = z.enum(['true', 'false']);

export const housingListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  minRent: numericString.optional(),
  maxRent: numericString.optional(),
  minPrice: numericString.optional(),
  maxPrice: numericString.optional(),
  listingType: z.enum(['SALE', 'RENT']).optional(),
  propertyType: z.enum(['LAND', 'HOUSE', 'APARTMENT', 'VILLA', 'COMMERCIAL', 'OTHER']).optional(),
  minArea: numericString.optional(),
  maxArea: numericString.optional(),
  minAvailableRooms: numericString.optional(),
  maxDistanceFpt: numericString.optional(),
  verifiedWithinDays: numericString.optional(),
  availability: z.enum(['AVAILABLE', 'LIMITED', 'FULL', 'UNKNOWN']).optional(),
  availableOnly: booleanString.optional(),
  partnerOnly: booleanString.optional(),
  airConditioner: booleanString.optional(),
  waterHeater: booleanString.optional(),
  privateBathroom: booleanString.optional(),
  loft: booleanString.optional(),
  balcony: booleanString.optional(),
  parking: booleanString.optional(),
  pets: booleanString.optional(),
  sort: z.enum(['recommended', 'rent_asc', 'rent_desc', 'price_asc', 'price_desc', 'distance', 'area_desc', 'freshest']).optional(),
  limit: numericString.optional(),
  offset: numericString.optional(),
  west: z.coerce.number().finite().min(-180).max(180).optional(),
  east: z.coerce.number().finite().min(-180).max(180).optional(),
  south: z.coerce.number().finite().min(-90).max(90).optional(),
  north: z.coerce.number().finite().min(-90).max(90).optional()
}).superRefine((params, context) => {
  const keys = ['west','east','south','north'];
  const count = keys.filter((key) => params[key] !== undefined).length;
  if (count > 0 && count !== 4) {
    context.addIssue({ code: 'custom', path: ['west'],
      message: 'Cần cả bốn cạnh của vùng bản đồ.' });
  }
  if (count === 4 && (params.west >= params.east ||
      params.south >= params.north ||
      params.east - params.west > 0.6 || params.north - params.south > 0.6)) {
    context.addIssue({ code: 'custom', path: ['west'],
      message: 'Vùng tìm kiếm không hợp lệ hoặc quá rộng.' });
  }
});

const nullableMoney = z.number().int().min(0).max(100000000).nullable().optional();
const nullableCount = z.number().int().min(0).max(10000).nullable().optional();
const nullableBoolean = z.boolean().nullable().optional();

export const partnerHousingSchema = z.object({
  monthlyRent: nullableMoney,
  depositAmount: nullableMoney,
  areaM2: z.number().positive().max(1000).nullable().optional(),
  availabilityStatus: z.enum(['AVAILABLE', 'LIMITED', 'FULL', 'UNKNOWN']).optional(),
  availableRooms: nullableCount,
  totalRooms: nullableCount,
  electricityPricePerKwh: z.number().int().min(0).max(100000).nullable().optional(),
  waterPricePerPersonMonth: nullableMoney,
  parkingFeeMonthly: nullableMoney,
  hasAirConditioner: nullableBoolean,
  hasWaterHeater: nullableBoolean,
  hasPrivateBathroom: nullableBoolean,
  hasLoft: nullableBoolean,
  hasBalcony: nullableBoolean,
  hasParking: nullableBoolean,
  allowsPets: nullableBoolean,
  curfewNote: z.string().trim().max(500).nullable().optional(),
  availabilityNote: z.string().trim().max(1000).nullable().optional(),
  contactZalo: z.string().trim().max(120).nullable().optional(),
  availableFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export const housingManageActionSchema = z.object({
  action: z.enum(['CONFIRM_ACTIVE', 'PAUSE', 'SOLD', 'RENTED']),
  availableRooms: z.number().int().min(0).max(10000).optional()
}).strict().superRefine((value,ctx)=>{
  if(value.availableRooms !== undefined && value.action !== 'CONFIRM_ACTIVE')
    ctx.addIssue({code:'custom',path:['availableRooms'],message:'Chỉ cập nhật phòng trống khi xác nhận hiệu lực.'});
});


const numericFilter = z.coerce.number().finite().nonnegative().max(100000000000000);
const areaFilter = z.coerce.number().finite().positive().max(100000);
const booleanFilter = z.union([z.boolean(), z.enum(['true','false'])
  .transform((v) => v === 'true')]);

// Explicitly persisted server-side only after login. No GPS, IP, session,
// phone, contact or arbitrary URL may be stored as search criteria.
export const savedHousingFiltersSchema = z.object({
  q: z.string().trim().min(2).max(100).optional(),
  listingType: z.enum(['SALE', 'RENT']).optional(),
  propertyType: z.enum(['LAND','HOUSE','APARTMENT','VILLA','COMMERCIAL','OTHER']).optional(),
  minPrice: numericFilter.optional(),
  maxPrice: numericFilter.optional(),
  minRent: numericFilter.optional(),
  maxRent: numericFilter.optional(),
  minArea: areaFilter.optional(),
  maxArea: areaFilter.optional(),
  availability: z.enum(['AVAILABLE','LIMITED','FULL','UNKNOWN']).optional(),
  availableOnly: booleanFilter.optional(),
  partnerOnly: booleanFilter.optional(),
  privateBathroom: booleanFilter.optional(),
  parking: booleanFilter.optional(),
  maxDistanceFpt: z.coerce.number().int().min(100).max(50000).optional()
}).strict().superRefine((v, ctx) => {
  for (const [min, max] of [['minPrice','maxPrice'], ['minRent','maxRent'], ['minArea','maxArea']]) {
    if (v[min] !== undefined && v[max] !== undefined && v[min] > v[max]) {
      ctx.addIssue({ code: 'custom', message: min + ' must not exceed ' + max, path: [min] });
    }
  }
});

export const createSavedHousingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  filters: savedHousingFiltersSchema
}).strict();

export const updateSavedHousingStatusSchema = z.object({
  enabled: z.boolean()
}).strict();

export const housingCompareQuerySchema = z.object({
  ids: z.string().regex(/^\d{1,15}(,\d{1,15}){1,3}$/)
}).strict();

export const savedHousingSearchIdSchema = z.object({
  id: z.string().regex(/^[1-9]\d{0,14}$/)
}).strict();

 
// Public price insight is aggregated ONLY from active published asking prices.
// Map viewport is optional, but incomplete or very wide coordinate bounds are
// not allowed (privacy / resource safety / ambiguous area attribution).
const insightLongitude = z.coerce.number().finite().min(-180).max(180);
const insightLatitude = z.coerce.number().finite().min(-90).max(90);
export const marketInsightsQuerySchema = z.object({
  listingType: z.enum(['SALE', 'RENT']).default('SALE'),
  propertyType: z.enum(['LAND','HOUSE','APARTMENT','VILLA','COMMERCIAL','OTHER']).optional(),
  west: insightLongitude.optional(),
  east: insightLongitude.optional(),
  south: insightLatitude.optional(),
  north: insightLatitude.optional()
}).strict().superRefine((query, context) => {
  const bounds = ['west','east','south','north'];
  const count = bounds.filter((key) => query[key] !== undefined).length;
  if (count > 0 && count < 4) {
    context.addIssue({ code: 'custom', path: ['west'], message: 'Thiếu giới hạn vùng bản đồ.' });
  }
  if (count === 4 && (query.west >= query.east || query.south >= query.north ||
      query.east - query.west > 0.6 || query.north - query.south > 0.6)) {
    context.addIssue({ code: 'custom', path: ['west'], message: 'Vùng bản đồ không hợp lệ hoặc quá rộng.' });
  }
});

export const housingAmenitiesQuerySchema = z.object({
  radius: z.enum(['500','1000','2000']).default('1000')
}).strict();

export const createHousingViewingSchema = z.object({
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
}).strict();
export const manageHousingViewingSchema = z.object({
  action: z.enum(['ACCEPT','DECLINE','CANCEL'])
}).strict();
