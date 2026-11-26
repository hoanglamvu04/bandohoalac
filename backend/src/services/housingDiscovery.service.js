import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

function validateId(value){
  if(!/^[1-9]\d{0,14}$/.test(String(value)))throw new AppError('Mã tin không hợp lệ.',400);
  return String(value);
}
const publicListing = `p.status='PUBLISHED' AND c.slug='bat-dong-san' AND h.listing_status='ACTIVE'
  AND (h.expires_at IS NULL OR h.expires_at>NOW()) AND p.external_source IS NULL`;
export async function getHousingHistory(placeId, db=pool){
  const id=validateId(placeId);
  const {rows}=await db.query(`SELECT x.observed_at,x.listing_type,x.asking_price_vnd,x.availability_status,x.available_rooms
    FROM housing_listing_history x JOIN places p ON p.id=x.place_id
    JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id
    WHERE x.place_id=$1 AND ${publicListing} ORDER BY x.observed_at DESC,x.id DESC LIMIT 30`,[id]);
  return {items:rows.map(x=>({observedAt:x.observed_at,listingType:x.listing_type,
    askingPriceVnd:x.asking_price_vnd==null?null:Number(x.asking_price_vnd),availabilityStatus:x.availability_status,
    availableRooms:x.available_rooms})),disclaimer:'Chỉ ghi nhận thay đổi từ khi tính năng hoạt động; giá chào, không phải giá giao dịch.'};
}
export async function getSimilarHousing(placeId,db=pool){
  const id=validateId(placeId);
  const {rows}=await db.query(`WITH anchor AS (
    SELECT p.id,p.location,h.property_type,h.listing_type,
      CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd ELSE h.monthly_rent END AS price
    FROM places p JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id
    WHERE p.id=$1 AND ${publicListing} AND h.property_type IS NOT NULL
  ), candidates AS (
    SELECT p.id,p.name,h.listing_type,h.property_type,h.area_m2,
      CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd ELSE h.monthly_rent END AS price,
      ROUND(ST_Distance(p.location::geography,a.location::geography))::int AS distance_m,
      ABS(LN(GREATEST(CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd ELSE h.monthly_rent END,1)::numeric / NULLIF(a.price,0))) AS price_distance
    FROM anchor a JOIN housing_listings h ON h.property_type=a.property_type AND h.listing_type=a.listing_type
    JOIN places p ON p.id=h.place_id JOIN categories c ON c.id=p.category_id
    WHERE p.id<>a.id AND ${publicListing} AND a.price>0
      AND (h.listing_type='SALE' OR h.availability_status<>'FULL')
      AND ST_DWithin(p.location::geography,a.location::geography,5000)
      AND CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd ELSE h.monthly_rent END BETWEEN a.price*0.5 AND a.price*1.5
  ) SELECT id,name,listing_type,property_type,area_m2,price,distance_m
    FROM candidates ORDER BY price_distance,distance_m,id LIMIT 6`,[id]);
  return {items:rows.map(x=>({id:String(x.id),name:x.name,listingType:x.listing_type,propertyType:x.property_type,
    areaM2:x.area_m2==null?null:Number(x.area_m2),priceVnd:Number(x.price),distanceM:Number(x.distance_m)})),
    criteria:'Cùng loại tài sản và giao dịch; trong 5 km đường thẳng; giá trong 50–150% giá tin hiện tại.'};
}

export const MIN_REFERENCE_SAMPLE=8;
export function classifyPriceRatio(value,median,count){
 const v=Number(value),m=Number(median),n=Number(count);
 if(!Number.isFinite(v)||!Number.isFinite(m)||v<=0||m<=0||!Number.isInteger(n)||n<MIN_REFERENCE_SAMPLE)return {status:'INSUFFICIENT_SAMPLE',sampleCount:Number.isInteger(n)&&n>=0?n:0,median:null,ratio:null};
 const ratio=v/m;
 return {status:ratio<0.5?'REVIEW_LOW':ratio>2?'REVIEW_HIGH':'WITHIN_REFERENCE_BAND',sampleCount:n,median:Math.round(m),ratio:Math.round(ratio*100)/100};
}
// Comparable asking prices only; not valuation, fraud scoring, or auto moderation.
export async function getHousingPriceReference(placeId,db=pool){
 const id=validateId(placeId);
 const eligible=`p.status='PUBLISHED' AND c.slug='bat-dong-san' AND h.listing_status='ACTIVE'
  AND (h.expires_at IS NULL OR h.expires_at>NOW()) AND p.external_source IS NULL
  AND p.slug NOT LIKE 'demo-thach-that-%' AND h.property_type IS NOT NULL
  AND h.area_m2>0 AND h.area_m2<=99999.99 AND (h.listing_type='SALE' OR h.availability_status<>'FULL')`;
 const amount=`CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd::numeric/NULLIF(h.area_m2,0) ELSE h.monthly_rent::numeric END`;
 const {rows:[row]}=await db.query(`WITH target AS (
  SELECT p.id,p.location,h.property_type,h.listing_type,h.area_m2,h.property_details->>'subtype' AS subtype,(${amount}) AS amount
  FROM places p JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id
  WHERE p.id=$1 AND ${eligible}
 ), comparables AS (
  SELECT (${amount}) AS amount
  FROM target t JOIN housing_listings h ON h.property_type=t.property_type AND h.listing_type=t.listing_type
  JOIN places p ON p.id=h.place_id JOIN categories c ON c.id=p.category_id
  WHERE p.id<>t.id AND ${eligible} AND (${amount})>0 AND (${amount})<=1000000000000
   AND t.amount>0 AND h.area_m2 BETWEEN t.area_m2*0.5 AND t.area_m2*2
   AND (t.subtype IS NULL OR h.property_details->>'subtype'=t.subtype)
   AND ST_DWithin(p.location::geography,t.location::geography,3000)
  ORDER BY ST_Distance(p.location::geography,t.location::geography),p.id LIMIT 100
 ) SELECT t.listing_type,t.amount,(SELECT COUNT(*)::int FROM comparables) AS sample_count,
  (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY amount) FROM comparables) AS median FROM target t`,[id]);
 const result=classifyPriceRatio(row?.amount,row?.median,row?.sample_count??0);
 return {...result,unit:row?.listing_type==='SALE'?'VND_PER_M2':row?.listing_type==='RENT'?'VND_PER_MONTH':null,
  minSample:MIN_REFERENCE_SAMPLE,radiusMeters:3000,
  disclaimer:'So sánh tối đa 100 tin chào gần nhất cùng loại, diện tích từ 0,5–2 lần và cùng subtype nếu có, trong 3 km. Chỉ cảnh báo cần kiểm tra khi dưới 0,5 hoặc trên 2 lần trung vị. Không phải định giá, kết luận gian lận hoặc giá giao dịch.'};
}
