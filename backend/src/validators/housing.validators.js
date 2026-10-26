import { z } from 'zod';

const numericString = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a non-negative number');
const booleanString = z.enum(['true', 'false']);

export const housingListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  minRent: numericString.optional(),
  maxRent: numericString.optional(),
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
  sort: z.enum(['recommended', 'rent_asc', 'rent_desc', 'distance', 'area_desc', 'freshest']).optional(),
  limit: numericString.optional(),
  offset: numericString.optional()
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
}).superRefine((housing, ctx) => {
  const { availabilityStatus: status, availableRooms, totalRooms } = housing;

  if (
    availableRooms !== undefined && availableRooms !== null &&
    totalRooms !== undefined && totalRooms !== null &&
    availableRooms > totalRooms
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['availableRooms'],
      message: 'Số phòng trống không được lớn hơn tổng số phòng.'
    });
  }

  if (status === 'FULL' && Number(availableRooms || 0) > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['availableRooms'],
      message: 'Tin hết phòng không thể có số phòng trống lớn hơn 0.'
    });
  }

  if ((status === 'AVAILABLE' || status === 'LIMITED') && availableRooms === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['availableRooms'],
      message: 'Tình trạng còn phòng phải có số phòng trống lớn hơn 0 hoặc để trống.'
    });
  }
});
