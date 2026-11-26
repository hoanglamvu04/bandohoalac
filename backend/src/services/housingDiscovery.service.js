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
