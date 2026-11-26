import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { MIN_VISIBLE_MARKET_SAMPLE } from './housingInsights.service.js';
const CELL=0.025;
const ELIGIBLE=`p.status='PUBLISHED' AND c.slug='bat-dong-san'
 AND p.external_source IS NULL AND p.slug NOT LIKE 'demo-thach-that-2026-%'
 AND h.listing_status='ACTIVE' AND (h.expires_at IS NULL OR h.expires_at>NOW())
 AND h.property_type IS NOT NULL AND (h.listing_type='SALE' OR h.availability_status<>'FULL')
 AND h.area_m2 BETWEEN 1 AND 99999.99`;
const PRICE=`CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd::numeric/NULLIF(h.area_m2,0) ELSE h.monthly_rent::numeric END`;
export async function getMarketGrid(filters,db=pool){
 const {listingType='SALE',propertyType=null,west,south,east,north}=filters;
 if(![west,south,east,north].every(Number.isFinite)||west>=east||south>=north||east-west>0.6||north-south>0.6)throw new AppError('Chọn vùng bản đồ nhỏ hơn để xem lưới giá.',400);
 const {rows}=await db.query(`WITH samples AS (
  SELECT FLOOR(ST_X(p.location)/$7::numeric)::int AS col,
    FLOOR(ST_Y(p.location)/$7::numeric)::int AS row,(${PRICE}) AS amount
  FROM places p JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id
  WHERE ${ELIGIBLE} AND h.listing_type=$1 AND ($2::text IS NULL OR h.property_type=$2)
    AND ST_Intersects(p.location,ST_MakeEnvelope($3,$4,$5,$6,4326))
 ) SELECT col,row,COUNT(*)::int AS sample_count,
   ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY amount))::bigint AS median
   FROM samples WHERE amount>0 AND amount<=1000000000000 GROUP BY col,row
   HAVING COUNT(*)>=$8 ORDER BY row DESC,col LIMIT 1000`,[listingType,propertyType,west,south,east,north,CELL,MIN_VISIBLE_MARKET_SAMPLE]);
 return {cellDegrees:CELL,listingType,propertyType,minSample:MIN_VISIBLE_MARKET_SAMPLE,
  unit:listingType==='SALE'?'VND_PER_M2':'VND_PER_MONTH',
  cells:rows.map(x=>({col:Number(x.col),row:Number(x.row),sampleCount:Number(x.sample_count),median:Number(x.median)})),
  disclaimer:'Ô lưới địa lý, không phải ranh giới hành chính; chỉ giá chào của tin thật còn hiệu lực, không phải giá giao dịch. Ô thiếu mẫu không hiển thị.'};
}
export async function recordMarketMonthlySnapshot(db=pool){
 const {rowCount}=await db.query(`WITH samples AS (
  SELECT h.listing_type,h.property_type,
    (CASE WHEN h.listing_type='SALE' THEN h.total_price_vnd ELSE h.monthly_rent END)::numeric/NULLIF(h.area_m2,0) AS amount
  FROM places p JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id
  WHERE ${ELIGIBLE}
 ), aggregates AS (
  SELECT listing_type,COALESCE(property_type,'ALL') AS property_group,COUNT(*)::int AS sample_count,
   CASE WHEN COUNT(*) >= $1 THEN ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY amount))::bigint END AS median
  FROM samples WHERE amount>=1 AND amount<=1000000000000
  GROUP BY GROUPING SETS((listing_type,property_type),(listing_type))
 )
 INSERT INTO housing_market_monthly(month_start,observed_day,listing_type,property_group,sample_count,median_vnd_m2)
 SELECT date_trunc('month',NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,types.listing_type,groups.property_group,
  COALESCE(a.sample_count,0),a.median
 FROM (VALUES('SALE'),('RENT')) types(listing_type)
 CROSS JOIN (VALUES('ALL'),('LAND'),('HOUSE'),('APARTMENT'),('VILLA'),('COMMERCIAL'),('OTHER')) groups(property_group)
 LEFT JOIN aggregates a ON a.listing_type=types.listing_type AND a.property_group=groups.property_group
 ON CONFLICT(month_start,listing_type,property_group) DO UPDATE SET
  observed_day=EXCLUDED.observed_day,sample_count=EXCLUDED.sample_count,median_vnd_m2=EXCLUDED.median_vnd_m2`,[MIN_VISIBLE_MARKET_SAMPLE]);
 return {groups:rowCount};
}
export async function getMarketTrend({listingType='SALE',propertyType=null},db=pool){
 const {rows}=await db.query(`SELECT to_char(month_start,'YYYY-MM') AS month,observed_day::text,sample_count,median_vnd_m2
 FROM housing_market_monthly WHERE listing_type=$1 AND property_group=$2
 AND month_start>=date_trunc('month',NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-INTERVAL '11 months'
 ORDER BY month_start`,[listingType,propertyType||'ALL']);
 return {listingType,propertyType,items:rows.map(x=>({month:x.month,observedDay:x.observed_day,sampleCount:Number(x.sample_count),
  medianVndM2:Number(x.sample_count)>=MIN_VISIBLE_MARKET_SAMPLE&&x.median_vnd_m2!=null?Number(x.median_vnd_m2):null})),
  disclaimer:'Ảnh chụp nguồn cung đang đăng theo ngày gần nhất mỗi tháng trên toàn vùng HOLA; không hồi tố, không phải chỉ số giá giao dịch; thành phần mẫu có thể thay đổi.'};
}
