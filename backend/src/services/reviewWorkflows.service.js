import {pool,withTransaction} from '../database/pool.js';
import {AppError} from '../utils/AppError.js';
import {serviceId as id} from './partnerServices.service.js';
import {SERVICE_AREA_GEOJSON_STRING} from '../config/mapCoverage.js';
import {advertiserReviewSchema,eventProposalSchema,eventReviewSchema} from '../validators/reviewWorkflows.validators.js';
const ADVERTISER_OK="p.status='PUBLISHED' AND c.slug='bat-dong-san' AND h.property_type IS NOT NULL AND h.listing_status='ACTIVE' AND (h.expires_at IS NULL OR h.expires_at>NOW()) AND p.source IN ('USER','CTV') AND p.external_source IS NULL AND p.slug NOT LIKE 'demo-thach-that-%' AND h.advertiser_role IN ('OWNER','BROKER','MANAGER') AND u.account_status='ACTIVE'";
const EVENT_OK="p.status='PUBLISHED' AND c.slug<>'bat-dong-san' AND p.location IS NOT NULL AND p.slug NOT LIKE 'demo-thach-that-%' AND ST_Intersects(p.location,ST_SetSRID(ST_GeomFromGeoJSON($2),4326))";
function requireRole(actor,roles){if(!actor||!roles.includes(actor.role))throw new AppError('Không có quyền duyệt.',403);}
function validate(schema,input){const x=schema.safeParse(input);if(!x.success)throw new AppError('Thông tin hoặc điều kiện xác nhận chưa hợp lệ.',400);return x.data;}
function advertiserRow(r){return {id:String(r.id),placeId:String(r.place_id),placeName:r.name||null,role:r.declared_role,status:r.status,createdAt:r.created_at,validUntil:r.valid_until};}
function eventRow(r){return {id:String(r.id),placeId:String(r.place_id),placeName:r.name||null,title:r.title,description:r.description,sourceUrl:r.source_url,startsAt:r.starts_at,endsAt:r.ends_at,status:r.status,featureId:r.feature_id==null?null:String(r.feature_id),createdAt:r.created_at};}
async function advertiserListing(client,place,lock=false){
 const {rows:[row]}=await client.query(`SELECT p.id,p.created_by,p.name,h.advertiser_role FROM places p JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id JOIN users u ON u.id=p.created_by WHERE p.id=$1 AND ${ADVERTISER_OK}${lock?' FOR UPDATE OF p,h':''}`,[id(place)]);
 return row||null;
}
async function eventPlace(client,place,lock=false){
 const {rows:[row]}=await client.query(`SELECT p.id,p.name FROM places p JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND ${EVENT_OK}${lock?' FOR UPDATE OF p':''}`,[id(place),SERVICE_AREA_GEOJSON_STRING]);
 if(!row)throw new AppError('Địa điểm không còn đủ điều kiện.',404);
 return row;
}
export async function publicAdvertiserStatus(place){
 const listing=await advertiserListing(pool,place);
 if(!listing)return {reviewed:false,role:null,validUntil:null};
 const {rows:[row]}=await pool.query(`SELECT q.valid_until FROM housing_advertiser_reviews q JOIN places p ON p.id=q.place_id JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id JOIN users u ON u.id=p.created_by
 WHERE q.place_id=$1 AND q.status='APPROVED' AND q.valid_until>NOW() AND q.requester_id=p.created_by AND q.declared_role=h.advertiser_role AND ${ADVERTISER_OK} ORDER BY q.valid_until DESC LIMIT 1`,[id(place)]);
 return {reviewed:Boolean(row),role:listing.advertiser_role,validUntil:row?.valid_until||null};
}
export async function myAdvertiserStatus(place,actor){
 const listing=await advertiserListing(pool,place);
 if(!listing||String(listing.created_by)!==String(actor))return {eligible:false,items:[],role:null};
 const {rows}=await pool.query('SELECT * FROM housing_advertiser_reviews WHERE place_id=$1 AND requester_id=$2 ORDER BY id DESC LIMIT 10',[id(place),actor]);
 return {eligible:true,role:listing.advertiser_role,items:rows.map(advertiserRow)};
}
export async function requestAdvertiserReview(place,actor){
 return withTransaction(async client=>{
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[actor]);
  const listing=await advertiserListing(client,place,true);
  if(!listing||String(listing.created_by)!==String(actor))throw new AppError('Chỉ người đăng tin đủ điều kiện được gửi yêu cầu.',403);
  const {rows:[count]}=await client.query("SELECT COUNT(*)::int AS n FROM housing_advertiser_reviews WHERE requester_id=$1 AND created_at>NOW()-INTERVAL '1 day'",[actor]);
  if(count.n>=5)throw new AppError('Đã đạt giới hạn yêu cầu hôm nay.',429);
  const {rows:[old]}=await client.query("SELECT id FROM housing_advertiser_reviews WHERE place_id=$1 AND (status='PENDING' OR (status='APPROVED' AND requester_id=$2 AND declared_role=$3 AND valid_until>NOW()))",[id(place),actor,listing.advertiser_role]);
  if(old)throw new AppError('Đã có yêu cầu hoặc kết quả còn hiệu lực.',409);
  const {rows:[row]}=await client.query('INSERT INTO housing_advertiser_reviews(place_id,requester_id,declared_role) VALUES($1,$2,$3) RETURNING *',[id(place),actor,listing.advertiser_role]);
  return advertiserRow(row);
 });
}
export async function advertiserReviewQueue(actor){
 requireRole(actor,['ADMIN']);
 const {rows}=await pool.query("SELECT q.*,p.name FROM housing_advertiser_reviews q JOIN places p ON p.id=q.place_id WHERE q.status='PENDING' OR (q.status='APPROVED' AND q.valid_until>NOW()) ORDER BY (q.status='PENDING') DESC,q.created_at DESC LIMIT 100");
 return {items:rows.map(r=>({...advertiserRow(r),requesterId:String(r.requester_id)}))};
}
export async function reviewAdvertiser(request,actor,input){
 requireRole(actor,['ADMIN']);const v=validate(advertiserReviewSchema,input);
 return withTransaction(async client=>{
  const {rows:[ref]}=await client.query('SELECT place_id FROM housing_advertiser_reviews WHERE id=$1',[id(request)]);
  if(!ref)throw new AppError('Không tìm thấy yêu cầu.',404);
  const listing=v.action==='APPROVE'?await advertiserListing(client,ref.place_id,true):null;
  const {rows:[q]}=await client.query('SELECT * FROM housing_advertiser_reviews WHERE id=$1 FOR UPDATE',[id(request)]);
  if(!q)throw new AppError('Không tìm thấy yêu cầu.',404);
  if(String(q.requester_id)===String(actor.id))throw new AppError('Không tự duyệt yêu cầu của mình.',403);
  if(v.action==='REVOKE'){
    if(q.status!=='APPROVED')throw new AppError('Chỉ thu hồi kết quả đã duyệt.',409);
    const {rows:[row]}=await client.query("UPDATE housing_advertiser_reviews SET status='REVOKED',revoked_at=NOW(),revoked_by=$2 WHERE id=$1 RETURNING *",[q.id,actor.id]);return advertiserRow(row);
  }
  if(q.status!=='PENDING')throw new AppError('Yêu cầu đã xử lý.',409);
  if(v.action==='APPROVE'&&(!listing||String(listing.created_by)!==String(q.requester_id)||listing.advertiser_role!==q.declared_role))throw new AppError('Tin hoặc vai trò đã thay đổi. Từ chối và yêu cầu gửi lại.',409);
  const {rows:[row]}=await client.query("UPDATE housing_advertiser_reviews SET status=$2,reviewed_by=$3,reviewed_at=NOW(),valid_until=CASE WHEN $2='APPROVED' THEN NOW()+INTERVAL '90 days' ELSE NULL END WHERE id=$1 RETURNING *",[q.id,v.action==='APPROVE'?'APPROVED':'REJECTED',actor.id]);return advertiserRow(row);
 });
}
export function validateEventWindow(startsAt,endsAt,now=Date.now()){
 const start=Date.parse(startsAt),end=Date.parse(endsAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<now||start>now+90*86400000||end<=start||end-start>7*86400000)throw new AppError('Sự kiện phải sắp diễn ra trong 90 ngày tới, kéo dài tối đa 7 ngày.',400);
}
export async function myEventProposals(place,actor){
 const {rows}=await pool.query('SELECT * FROM community_event_proposals WHERE place_id=$1 AND requester_id=$2 ORDER BY id DESC LIMIT 10',[id(place),actor]);return {items:rows.map(eventRow)};
}
export async function submitCommunityEvent(place,actor,input){
 const v=validate(eventProposalSchema,input);validateEventWindow(v.startsAt,v.endsAt);
 return withTransaction(async client=>{
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[actor]);
  await eventPlace(client,place,true);
  const {rows:[count]}=await client.query("SELECT COUNT(*)::int AS n FROM community_event_proposals WHERE requester_id=$1 AND created_at>NOW()-INTERVAL '1 day'",[actor]);
  if(count.n>=5)throw new AppError('Đã đạt giới hạn gửi sự kiện hôm nay.',429);
  const {rows:[dup]}=await client.query("SELECT id FROM community_event_proposals WHERE place_id=$1 AND lower(title)=lower($2) AND starts_at=$3 AND status IN ('PENDING','APPROVED')",[id(place),v.title,v.startsAt]);
  if(dup)throw new AppError('Sự kiện tương tự đã được gửi.',409);
  const {rows:[row]}=await client.query('INSERT INTO community_event_proposals(place_id,requester_id,title,description,source_url,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id(place),actor,v.title,v.description,v.sourceUrl,v.startsAt,v.endsAt]);return eventRow(row);
 });
}
export async function communityEventQueue(actor){
 requireRole(actor,['ADMIN','MODERATOR']);
 const {rows}=await pool.query("SELECT q.*,p.name FROM community_event_proposals q JOIN places p ON p.id=q.place_id WHERE q.status='PENDING' OR (q.status='APPROVED' AND q.ends_at>NOW()) ORDER BY (q.status='PENDING') DESC,q.created_at DESC LIMIT 100");return {items:rows.map(eventRow)};
}
export async function reviewCommunityEvent(request,actor,input){
 requireRole(actor,['ADMIN','MODERATOR']);const v=validate(eventReviewSchema,input);
 return withTransaction(async client=>{
  const {rows:[ref]}=await client.query('SELECT place_id FROM community_event_proposals WHERE id=$1',[id(request)]);
  if(!ref)throw new AppError('Không tìm thấy sự kiện.',404);
  if(v.action==='APPROVE')await eventPlace(client,ref.place_id,true);
  const {rows:[q]}=await client.query('SELECT * FROM community_event_proposals WHERE id=$1 FOR UPDATE',[id(request)]);
  if(!q)throw new AppError('Không tìm thấy sự kiện.',404);
  if(String(q.requester_id)===String(actor.id))throw new AppError('Không tự duyệt sự kiện của mình.',403);
  if(v.action==='REVOKE'){
    if(q.status!=='APPROVED')throw new AppError('Sự kiện chưa được duyệt.',409);
    if(q.feature_id)await client.query("UPDATE map_features SET status='ARCHIVED',updated_by=$2,updated_at=NOW() WHERE id=$1",[q.feature_id,actor.id]);
    const {rows:[row]}=await client.query("UPDATE community_event_proposals SET status='REVOKED',revoked_at=NOW(),revoked_by=$2 WHERE id=$1 RETURNING *",[q.id,actor.id]);return eventRow(row);
  }
  if(q.status!=='PENDING')throw new AppError('Sự kiện đã xử lý.',409);
  let featureId=null;
  if(v.action==='APPROVE'){
    validateEventWindow(q.starts_at,q.ends_at);
    // The location comes from the canonical public place, never from a user GPS upload.
    const props={communityEventProposalId:String(q.id),placeId:String(q.place_id),description:q.description,eventStartsAt:new Date(q.starts_at).toISOString(),eventEndsAt:new Date(q.ends_at).toISOString(),sourceLabel:'Đóng góp cộng đồng đã qua duyệt',verificationStatus:'VERIFIED'};
    const {rows:[feature]}=await client.query("INSERT INTO map_features(layer_type,name,geometry,properties,severity,status,valid_from,valid_until,created_by,updated_by) SELECT 'EVENT',$2,p.location,$3::jsonb,'INFO','ACTIVE',NOW(),$4,$5,$5 FROM places p WHERE p.id=$1 RETURNING id",[q.place_id,q.title,JSON.stringify(props),q.ends_at,actor.id]);featureId=feature.id;
  }
  const {rows:[row]}=await client.query('UPDATE community_event_proposals SET status=$2,feature_id=$3,reviewed_by=$4,reviewed_at=NOW() WHERE id=$1 RETURNING *',[q.id,v.action==='APPROVE'?'APPROVED':'REJECTED',featureId,actor.id]);return eventRow(row);
 });
}
