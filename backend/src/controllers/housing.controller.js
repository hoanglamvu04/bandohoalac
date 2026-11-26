import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { getHousingContactForMember } from '../services/housingContact.service.js';
import { hasHousingMetricConsent, recordHousingMetric } from '../services/housingMetrics.service.js';
import {
  getHousingListingByPlaceId,
  listHousingListings
} from '../services/housing.service.js';

export const listHousing = asyncHandler(async (req, res) => {
  const result = await listHousingListings(req.query);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(result);
});

export const getHousing = asyncHandler(async (req, res) => {
  const item = await getHousingListingByPlaceId(Number(req.params.placeId));
  if (!item) throw new AppError('Không tìm thấy phòng trọ.', 404);
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  res.json({ item });
});

export const revealHousingContact = asyncHandler(async (req, res) => {
  const contact = await getHousingContactForMember(req.params.placeId);
  res.set('Cache-Control', 'private, no-store');
  res.set('Pragma', 'no-cache');
  res.vary('Authorization');
  // Count only a successful actual phone reveal, if the visitor opted in.
  // Optional metrics must not interfere with the existing contact flow.
  if(!contact.isDemo && /^\+?[0-9][0-9\s().-]{7,18}$/.test(contact.phone||'') && hasHousingMetricConsent(req)){
    try{await recordHousingMetric(req.params.placeId,'CONTACT_REVEAL');}catch{/* optional aggregate */}
  }
  res.json({ contact });
});

export const recordHousingDetailView=asyncHandler(async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(hasHousingMetricConsent(req)){
    // No visitor data in request body or stored metrics.
    if(req.body&&Object.keys(req.body).length)throw new AppError('Không gửi dữ liệu cá nhân vào thống kê.',400);
    try{await recordHousingMetric(req.params.placeId,'DETAIL_VIEW');}catch{/* optional aggregate */}
  }
  res.status(204).end();
});
