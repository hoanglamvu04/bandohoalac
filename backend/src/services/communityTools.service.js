import { pool,withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { invalidatePlaceBoundsCache } from './place.service.js';
import { roomTypesSchema } from '../validators/communityTools.validators.js';
import { serviceId as id } from './partnerServices.service.js';

export function projectRoomTypes(input){
 const parsed=roomTypesSchema.safeParse(input);
 if(!parsed.success)throw new AppError('Danh sách loại phòng không hợp lệ.',400);
 const types=parsed.data;
 const available=types.filter(t=>t.availableRooms>0);
 const representative=[...(available.length?available:types)].sort((a,b)=>a.monthlyRentVnd-b.monthlyRentVnd)[0];
 const availableRooms=types.reduce((n,t)=>n+t.availableRooms,0);
 return {types,representative,totalRooms:types.reduce((n,t)=>n+t.totalRooms,0),availableRooms,availabilityStatus:availableRooms>0?'AVAILABLE':'FULL'};
}
const ROOM_OK="p.status='PUBLISHED' AND c.slug='bat-dong-san' AND h.listing_type='RENT' AND h.property_type IN ('HOUSE','APARTMENT') AND h.listing_status='ACTIVE' AND (h.expires_at IS NULL OR h.expires_at>NOW()) AND p.external_source IS NULL AND p.source IN ('USER','CTV') AND p.slug NOT LIKE 'demo-thach-that-%'";
async function roomRow(client,place,lock=false){
 const {rows:[row]}=await client.query(`SELECT p.id,p.created_by,p.name,h.room_types,h.room_catalog_version FROM places p
 JOIN categories c ON c.id=p.category_id JOIN housing_listings h ON h.place_id=p.id
 WHERE p.id=$1 AND ${ROOM_OK}${lock?' FOR UPDATE OF p,h':''}`,[id(place)]);
 if(!row)throw new AppError('Tin cho thuê không còn đủ điều kiện.',404);
 return row;
}
function owner(row,user){if(String(row.created_by)!==String(user))throw new AppError('Chỉ người đăng được quản lý loại phòng.',403);}
function roomResponse(row){return {types:row.room_types||[],version:Number(row.room_catalog_version)};}
function proposal(r){return {id:String(r.id),placeId:String(r.place_id),placeName:r.name,types:r.types,status:r.status,baseVersion:r.base_version,createdAt:r.created_at};}
export async function publicRooms(place){const row=await roomRow(pool,place);return {types:roomResponse(row).types};}
export async function ownRooms(place,user){
 const row=await roomRow(pool,place);owner(row,user);
 const {rows}=await pool.query("SELECT * FROM housing_room_catalog_proposals WHERE place_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 10",[id(place),user]);
 return {...roomResponse(row),proposals:rows.map(proposal)};
}
export async function submitRooms(place,user,input){
 return withTransaction(async client=>{
  const row=await roomRow(client,place,true);owner(row,user);
  if(Number(row.room_catalog_version)!==input.baseVersion)throw new AppError('Danh sách đã thay đổi, hãy tải lại.',409);
  const {rows:[pending]}=await client.query("SELECT id FROM housing_room_catalog_proposals WHERE place_id=$1 AND status='PENDING'",[id(place)]);
  if(pending)throw new AppError('Đã có yêu cầu đang chờ duyệt.',409);
  const {types}=projectRoomTypes(input.types);
  const {rows:[saved]}=await client.query("INSERT INTO housing_room_catalog_proposals(place_id,user_id,base_version,types) VALUES($1,$2,$3,$4::jsonb) RETURNING *",[id(place),user,input.baseVersion,JSON.stringify(types)]);
  return proposal(saved);
 });
}
export async function cancelRooms(place,request,user){
 const {rows:[saved]}=await pool.query("UPDATE housing_room_catalog_proposals SET status='CANCELLED' WHERE id=$1 AND place_id=$2 AND user_id=$3 AND status='PENDING' RETURNING *",[id(request),id(place),user]);
 if(!saved)throw new AppError('Không tìm thấy yêu cầu chờ duyệt của bạn.',404);
 return proposal(saved);
}
export async function roomQueue(){
 const {rows}=await pool.query("SELECT q.*,p.name FROM housing_room_catalog_proposals q JOIN places p ON p.id=q.place_id WHERE q.status='PENDING' ORDER BY q.created_at,q.id LIMIT 100");
 return {items:rows.map(proposal)};
}
export async function reviewRooms(request,actor,action){
 const result=await withTransaction(async client=>{
  const {rows:[ref]}=await client.query("SELECT place_id FROM housing_room_catalog_proposals WHERE id=$1",[id(request)]);
  if(!ref)throw new AppError('Không tìm thấy yêu cầu.',404);
  // Lock the canonical listing before the proposal, the same order as submission.
  const row=action==='APPROVE'?await roomRow(client,ref.place_id,true):null;
  const {rows:[q]}=await client.query("SELECT * FROM housing_room_catalog_proposals WHERE id=$1 AND status='PENDING' FOR UPDATE",[id(request)]);
  if(!q)throw new AppError('Yêu cầu đã được xử lý.',409);
  if(action==='APPROVE'){
   owner(row,q.user_id);
   if(Number(row.room_catalog_version)!==q.base_version)throw new AppError('Yêu cầu cũ; từ chối và đề nghị gửi lại.',409);
   const x=projectRoomTypes(q.types),t=x.representative;
   await client.query("UPDATE housing_listings SET room_types=$2::jsonb,room_catalog_version=room_catalog_version+1,monthly_rent=$3,deposit_amount=$4,area_m2=$5,total_rooms=$6,available_rooms=$7,availability_status=$8,updated_at=NOW() WHERE place_id=$1",[q.place_id,JSON.stringify(x.types),t.monthlyRentVnd,t.depositVnd,t.areaM2,x.totalRooms,x.availableRooms,x.availabilityStatus]);
   await client.query("UPDATE places SET price_level=$2,updated_at=NOW() WHERE id=$1",[q.place_id,'Từ '+new Intl.NumberFormat('vi-VN').format(t.monthlyRentVnd)+' đ/tháng']);
   if(x.availableRooms===0)await client.query("UPDATE housing_viewing_requests SET status='CANCELLED',updated_at=NOW() WHERE place_id=$1 AND starts_at>NOW() AND status IN ('PENDING','ACCEPTED')",[q.place_id]);
  }
  const {rows:[saved]}=await client.query("UPDATE housing_room_catalog_proposals SET status=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1 RETURNING *",[q.id,action==='APPROVE'?'APPROVED':'REJECTED',actor]);
  return proposal(saved);
 });
 invalidatePlaceBoundsCache();
 return result;
}

const QA_OK="p.status='PUBLISHED' AND c.slug<>'bat-dong-san' AND p.slug NOT LIKE 'demo-thach-that-%'";
async function qaPlace(client,place,lock=false){
 const {rows:[row]}=await client.query(`SELECT p.id FROM places p JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND ${QA_OK}${lock?' FOR UPDATE OF p':''}`,[id(place)]);
 if(!row)throw new AppError('Địa điểm không còn công khai.',404);
}
function publicPost(r){return {id:String(r.id),parentId:r.parent_id==null?null:String(r.parent_id),body:r.body,createdAt:r.created_at};}
export async function publicQA(place){
 await qaPlace(pool,place);
 const {rows}=await pool.query(`SELECT q.id,q.body,q.created_at,
 COALESCE((SELECT jsonb_agg(a ORDER BY a.created_at,a.id) FROM (SELECT id,parent_id,body,created_at FROM place_qa_posts WHERE parent_id=q.id AND status='PUBLISHED' AND kind='ANSWER' ORDER BY created_at,id LIMIT 20) a),'[]'::jsonb) AS answers
 FROM place_qa_posts q JOIN places p ON p.id=q.place_id JOIN categories c ON c.id=p.category_id
 WHERE q.place_id=$1 AND ${QA_OK} AND q.kind='QUESTION' AND q.status='PUBLISHED' ORDER BY q.created_at DESC,q.id DESC LIMIT 30`,[id(place)]);
 return {items:rows.map(q=>({...publicPost(q),answers:q.answers.map(publicPost)}))};
}
export async function submitQA(place,user,input){
 return withTransaction(async client=>{
  await qaPlace(client,place,true);
  const parent=input.parentId||null;
  if(parent){
   const {rows:[q]}=await client.query("SELECT id FROM place_qa_posts WHERE id=$1 AND place_id=$2 AND kind='QUESTION' AND status='PUBLISHED' FOR UPDATE",[id(parent),id(place)]);
   if(!q)throw new AppError('Câu hỏi không còn công khai.',404);
  }
  const {rows:[n]}=await client.query("SELECT COUNT(*)::int AS count FROM place_qa_posts WHERE author_id=$1 AND created_at>NOW()-INTERVAL '1 day'",[user]);
  if(n.count>=20)throw new AppError('Đã đạt giới hạn gửi hỏi đáp hôm nay.',429);
  const {rows:[duplicate]}=await client.query("SELECT id FROM place_qa_posts WHERE place_id=$1 AND author_id=$2 AND parent_id IS NOT DISTINCT FROM $3::bigint AND lower(body)=lower($4) AND status IN ('PENDING','PUBLISHED')",[id(place),user,parent,input.body]);
  if(duplicate)throw new AppError('Nội dung đã được gửi.',409);
  const {rows:[saved]}=await client.query("INSERT INTO place_qa_posts(place_id,author_id,parent_id,kind,body) VALUES($1,$2,$3,$4,$5) RETURNING id,status",[id(place),user,parent,parent?'ANSWER':'QUESTION',input.body]);
  return {id:String(saved.id),status:saved.status};
 });
}
export async function reportQA(place,post,user,reason){
 const {rows:[saved]}=await pool.query(`INSERT INTO place_qa_reports(post_id,reporter_id,reason)
 SELECT q.id,$3,$4 FROM place_qa_posts q JOIN places p ON p.id=q.place_id JOIN categories c ON c.id=p.category_id
 WHERE q.place_id=$1 AND q.id=$2 AND q.status='PUBLISHED' AND ${QA_OK} AND q.author_id<>$3
 AND (q.parent_id IS NULL OR EXISTS(SELECT 1 FROM place_qa_posts parent WHERE parent.id=q.parent_id AND parent.status='PUBLISHED'))
 ON CONFLICT(post_id,reporter_id) DO NOTHING RETURNING post_id`,[id(place),id(post),user,reason]);
 if(!saved)throw new AppError('Không thể báo cáo hoặc bạn đã báo cáo nội dung này.',409);
 return {ok:true};
}
export async function qaQueue(){
 const {rows}=await pool.query(`SELECT q.id,q.place_id,p.name,q.kind,q.parent_id,q.body,q.status,q.created_at,
 (SELECT COUNT(*)::int FROM place_qa_reports r WHERE r.post_id=q.id AND r.resolved_at IS NULL) AS reports
 FROM place_qa_posts q JOIN places p ON p.id=q.place_id
 WHERE q.status='PENDING' OR (q.status='PUBLISHED' AND EXISTS(SELECT 1 FROM place_qa_reports r WHERE r.post_id=q.id AND r.resolved_at IS NULL))
 ORDER BY q.created_at,q.id LIMIT 100`);
 return {items:rows.map(q=>({...publicPost(q),placeId:String(q.place_id),placeName:q.name,kind:q.kind,status:q.status,reportCount:q.reports}))};
}
export async function reviewQA(post,actor,action){
 return withTransaction(async client=>{
  const {rows:[ref]}=await client.query("SELECT place_id FROM place_qa_posts WHERE id=$1",[id(post)]);
  if(!ref)throw new AppError('Không tìm thấy nội dung.',404);
  if(action==='APPROVE')await qaPlace(client,ref.place_id,true);
  const {rows:[q]}=await client.query("SELECT * FROM place_qa_posts WHERE id=$1 FOR UPDATE",[id(post)]);
  if(!q)throw new AppError('Không tìm thấy nội dung.',404);
  if(['APPROVE','REJECT'].includes(action)&&q.status!=='PENDING')throw new AppError('Nội dung đã được xử lý.',409);
  if(['ARCHIVE','DISMISS_REPORTS'].includes(action)&&q.status!=='PUBLISHED')throw new AppError('Nội dung không công khai.',409);
  if(action==='APPROVE'&&q.parent_id){
   const {rows:[parent]}=await client.query("SELECT id FROM place_qa_posts WHERE id=$1 AND place_id=$2 AND kind='QUESTION' AND status='PUBLISHED' FOR UPDATE",[q.parent_id,q.place_id]);
   if(!parent)throw new AppError('Câu hỏi gốc không còn công khai.',409);
  }
  const next={APPROVE:'PUBLISHED',REJECT:'REJECTED',ARCHIVE:'ARCHIVED'}[action];
  if(next)await client.query("UPDATE place_qa_posts SET status=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1",[q.id,next,actor]);
  if(action==='ARCHIVE'||action==='DISMISS_REPORTS')await client.query("UPDATE place_qa_reports SET resolved_at=NOW() WHERE post_id=$1 AND resolved_at IS NULL",[q.id]);
  return {id:String(q.id),status:next||q.status};
 });
}
