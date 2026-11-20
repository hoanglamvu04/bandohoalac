import { z } from 'zod';
import { isInsideServiceCoverage } from '../config/mapCoverage.js';

const CONTRIBUTION_TYPES = [
  'CREATE_PLACE', 'UPDATE_PLACE', 'ADD_PHOTO', 'FIX_LOCATION',
  'UPDATE_HOURS', 'UPDATE_PRICE', 'REPORT_CLOSED', 'REPORT_WRONG_INFO',
  'REPORT_FLOOD', 'REPORT_ROAD_CLOSURE', 'REPORT_ALERT'
];

const ROAD_STATUS_TYPES = new Set([
  'REPORT_FLOOD', 'REPORT_ROAD_CLOSURE', 'REPORT_ALERT'
]);

const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().nonnegative().optional(),
  timestamp: z.coerce.number().optional()
});

// Property details are validated before they reach the pending moderation
// queue. Neither submission nor community verification publishes a listing.
export const realEstateSubmissionSchema = z.object({
  transactionType: z.enum(['SALE', 'RENT']),
  propertyType: z.enum(['LAND', 'HOUSE', 'APARTMENT', 'VILLA', 'COMMERCIAL', 'OTHER']),
  areaM2: z.coerce.number().positive().max(99999.99),
  totalPriceVnd: z.coerce.number().int().positive().max(1000000000000000).optional(),
  monthlyRentVnd: z.coerce.number().int().positive().max(100000000).optional(),
  contactName: z.string().trim().min(2).max(120),
  publicContactConsent: z.literal(true, {
    errorMap: () => ({ message: 'Bạn cần đồng ý công khai thông tin liên hệ khi tin được duyệt.' })
  }),
  imageRightsConfirmed: z.boolean().optional()
}).superRefine((value, ctx) => {
  if (value.transactionType === 'SALE' && value.monthlyRentVnd !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'Giá thuê không áp dụng cho tin cần bán.', path: ['monthlyRentVnd'] });
  }
  if (value.transactionType === 'RENT' && value.totalPriceVnd !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'Tổng giá bán không áp dụng cho tin cho thuê.', path: ['totalPriceVnd'] });
  }
  if (value.transactionType === 'SALE' && value.totalPriceVnd === undefined) {
    ctx.addIssue({
      code: 'custom', message: 'Vui lòng nhập tổng giá bán (VND).', path: ['totalPriceVnd']
    });
  }
  if (value.transactionType === 'RENT' && value.monthlyRentVnd === undefined) {
    ctx.addIssue({
      code: 'custom', message: 'Vui lòng nhập giá cho thuê mỗi tháng (VND).', path: ['monthlyRentVnd']
    });
  }
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
    website: z.string().trim().max(200).optional(),
    realEstate: realEstateSubmissionSchema.optional()
  }).optional(),
  reason: z.string().trim().max(500).optional(),
  fieldKey: z.enum(['ADDRESS', 'OPENING_HOURS', 'PHONE']).optional(),
  suggestedValue: z.string().trim().max(1000).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  expiresHours: z.coerce.number().int().min(1).max(168).optional()
}).superRefine((data, ctx) => {
  const isRoadStatus = ROAD_STATUS_TYPES.has(data.type);

  if (data.type === 'CREATE_PLACE' || data.type === 'FIX_LOCATION' || isRoadStatus) {
    if (!data.location) {
      ctx.addIssue({ code: 'custom', message: 'location is required for this contribution type.', path: ['location'] });
    } else if (!isInsideServiceCoverage(data.location.lng, data.location.lat)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Location is outside the Hola Maps service area.',
        path: ['location']
      });
    }
  }
  if (data.type === 'CREATE_PLACE' && !data.place?.name) {
    ctx.addIssue({ code: 'custom', message: 'place.name is required to create a place.', path: ['place', 'name'] });
  }
  if (data.type === 'CREATE_PLACE' && data.place?.categorySlug === 'bat-dong-san' && !data.place?.realEstate) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vui lòng dùng mẫu đăng tin bất động sản để điền giá, diện tích và liên hệ.',
      path: ['place', 'realEstate']
    });
  }
  if (data.place?.realEstate) {
    if (data.type !== 'CREATE_PLACE' || data.place.categorySlug !== 'bat-dong-san') {
      ctx.addIssue({
        code: 'custom',
        message: 'Tin bất động sản chỉ được gửi bằng yêu cầu tạo địa điểm thuộc danh mục Bất động sản.',
        path: ['place', 'realEstate']
      });
    }
    if (!data.place.address) {
      ctx.addIssue({ code: 'custom', message: 'Vui lòng nhập địa chỉ bất động sản.', path: ['place', 'address'] });
    }
    if (!data.place.phone) {
      ctx.addIssue({ code: 'custom', message: 'Vui lòng nhập số điện thoại liên hệ.', path: ['place', 'phone'] });
    }
  }
  if (data.type !== 'CREATE_PLACE' && !isRoadStatus && !data.placeId) {
    ctx.addIssue({ code: 'custom', message: 'placeId is required for this contribution type.', path: ['placeId'] });
  }

  if (data.fieldKey && data.type !== 'REPORT_WRONG_INFO') {
    ctx.addIssue({
      code: 'custom',
      message: 'fieldKey chỉ được dùng khi báo sai thông tin địa điểm.',
      path: ['fieldKey']
    });
  }
  if (data.type === 'REPORT_WRONG_INFO' && data.fieldKey && !data.reason?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vui lòng mô tả lý do báo sai thông tin.',
      path: ['reason']
    });
  }

  if (isRoadStatus && !data.reason?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vui lòng mô tả ngắn tình trạng thực tế.',
      path: ['reason']
    });
  }
});

export const communityVerificationSchema = z.object({
  verdict: z.enum(['CONFIRM', 'DISPUTE', 'UNSURE']),
  reason: z.string().trim().max(500).optional()
}).superRefine((data, ctx) => {
  if (data.verdict === 'DISPUTE' && !data.reason?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vui lòng nêu lý do khi phản đối đóng góp.',
      path: ['reason']
    });
  }
});
