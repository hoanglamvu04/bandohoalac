import { pool,withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { validateViewingTime } from './housingViewings.service.js';
import { catalogServiceSchema } from '../validators/partnerServices.validators.js';

export function serviceId(value){
 const v=String(value);
 if(!/^[1-9]\d{0,14}$/.test(v))throw new AppError('Mã không hợp lệ.',400);
 return v;
}
const ELIGIBLE=`p.status='PUBLISHED' AND c.slug<>'bat-dong-san' AND pp.status='ACTIVE'
 AND p.slug NOT LIKE 'demo-thach-that-%'`;
const OWNER=`(EXISTS(SELECT 1 FROM partner_memberships pm WHERE pm.partner_id=pp.id AND pm.user_id=$2 AND pm.role='OWNER' AND pm.status='ACTIVE')
 OR EXISTS(SELECT 1 FROM place_managers pm WHERE pm.place_id=p.id AND pm.user_id=$2 AND pm.role='OWNER'))`;
function mappedService(s){
 return {id:String(s.id),placeId:String(s.place_id),title:s.title,description:s.description,priceVnd:s.price_vnd==null?null:Number(s.price_vnd),active:s.active,updatedAt:s.updated_at};
}
function mappedRequest(s){
 return {id:String(s.id),serviceId:String(s.service_id),serviceTitle:s.title,startsAt:s.starts_at,status:s.status};
}
async function ownerPlace(place,actor,client=pool,lock=false){
 const {rows:[row]}=await client.query(`SELECT p.id FROM places p JOIN categories c ON c.id=p.category_id
 JOIN place_partners pp ON pp.place_id=p.id WHERE p.id=$1 AND ${ELIGIBLE} AND ${OWNER}${lock?' FOR UPDATE OF p,pp':''}`,[serviceId(place),actor]);
 if(!row)throw new AppError('Không tìm thấy địa điểm đối tác được quản lý.',404);
}
export async function publicCatalog(place,db=pool){
 const {rows}=await db.query(`SELECT s.* FROM partner_services s JOIN places p ON p.id=s.place_id JOIN categories c ON c.id=p.category_id
 JOIN place_partners pp ON pp.place_id=p.id WHERE p.id=$1 AND ${ELIGIBLE} AND s.active=true ORDER BY s.id LIMIT 50`,[serviceId(place)]);
 return {items:rows.map(mappedService)};
}
export async function ownerCatalog(place,actor){
 await ownerPlace(place,actor);
 const {rows}=await pool.query('SELECT * FROM partner_services WHERE place_id=$1 ORDER BY active DESC,id LIMIT 50',[serviceId(place)]);
 return {items:rows.map(mappedService)};
}
export async function createCatalogService(place,actor,input){
 const validated=catalogServiceSchema.safeParse(input);
 if(!validated.success)throw new AppError('Dữ liệu dịch vụ không hợp lệ.',400);
 return withTransaction(async client=>{
  await ownerPlace(place,actor,client,true);
  const {rows:[n]}=await client.query('SELECT COUNT(*)::int AS count FROM partner_services WHERE place_id=$1',[serviceId(place)]);
  if(n.count>=50)throw new AppError('Đã đạt giới hạn 50 dịch vụ.',409);
  const x=validated.data;
  const {rows:[saved]}=await client.query('INSERT INTO partner_services(place_id,title,description,price_vnd) VALUES($1,$2,$3,$4) RETURNING *',[serviceId(place),x.title,x.description,x.priceVnd]);
  return mappedService(saved);
 });
}
export async function setServiceActive(place,service,actor,active){
 return withTransaction(async client=>{
  await ownerPlace(place,actor,client,true);
  const {rows:[saved]}=await client.query('UPDATE partner_services SET active=$3,updated_at=now() WHERE id=$1 AND place_id=$2 RETURNING *',[serviceId(service),serviceId(place),active]);
  if(!saved)throw new AppError('Không tìm thấy dịch vụ.',404);
  if(!active)await client.query("UPDATE partner_service_requests SET status='CANCELLED',updated_at=now() WHERE service_id=$1 AND status='PENDING'",[serviceId(service)]);
  return mappedService(saved);
 });
}
export async function createServiceRequest(service,actor,startsAt){
 const id=serviceId(service);const slot=validateViewingTime(startsAt);
 try{return await withTransaction(async client=>{
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[actor]);
  const {rows:[item]}=await client.query(`SELECT s.id,s.title FROM partner_services s JOIN places p ON p.id=s.place_id
   JOIN categories c ON c.id=p.category_id JOIN place_partners pp ON pp.place_id=p.id
   WHERE s.id=$1 AND s.active AND ${ELIGIBLE} AND NOT ${OWNER} FOR UPDATE OF s,p,pp`,[id,actor]);
  if(!item)throw new AppError('Dịch vụ không nhận lịch hẹn hoặc là dịch vụ của bạn.',404);
  const {rows:[n]}=await client.query("SELECT COUNT(*)::int AS total FROM partner_service_requests WHERE requester_id=$1 AND starts_at>now() AND status IN ('PENDING','ACCEPTED')",[actor]);
  if(n.total>=10)throw new AppError('Đã đạt giới hạn 10 yêu cầu mở.',409);
  const {rows:[saved]}=await client.query('INSERT INTO partner_service_requests(service_id,requester_id,starts_at) VALUES($1,$2,$3) RETURNING *',[id,actor,slot]);
  return mappedRequest({...saved,title:item.title});
 });}catch(e){if(e.code==='23505')throw new AppError('Bạn đã gửi yêu cầu cho khung giờ này.',409);throw e;}
}
export async function listOwnServiceRequests(place,actor){
 const {rows}=await pool.query(`SELECT q.*,s.title FROM partner_service_requests q JOIN partner_services s ON s.id=q.service_id
 WHERE s.place_id=$1 AND q.requester_id=$2 ORDER BY q.created_at DESC LIMIT 50`,[serviceId(place),actor]);
 return {items:rows.map(mappedRequest)};
}
export async function listOwnerServiceRequests(place,actor){
 await ownerPlace(place,actor);
 const {rows}=await pool.query(`SELECT q.*,s.title FROM partner_service_requests q JOIN partner_services s ON s.id=q.service_id
 WHERE s.place_id=$1 ORDER BY (q.starts_at>now() AND q.status='PENDING') DESC,q.starts_at DESC LIMIT 100`,[serviceId(place)]);
 const {rows:[counts]}=await pool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE q.status='ACCEPTED')::int AS accepted,COUNT(*) FILTER(WHERE q.status='PENDING')::int AS pending
 FROM partner_service_requests q JOIN partner_services s ON s.id=q.service_id WHERE s.place_id=$1 AND q.created_at>=now()-interval '30 days'`,[serviceId(place)]);
 return {items:rows.map(mappedRequest),last30Days:counts};
}
export async function actServiceRequest(request,actor,action){
 return withTransaction(async client=>{
  const {rows:[initial]}=await client.query(`SELECT s.place_id FROM partner_service_requests q JOIN partner_services s ON s.id=q.service_id WHERE q.id=$1`,[serviceId(request)]);
  if(!initial)throw new AppError('Không tìm thấy yêu cầu.',404);
  // Lock in the same order as catalog mutation; do not expose any contact.
  const {rows:[owner]}=await client.query(`SELECT p.id FROM places p JOIN categories c ON c.id=p.category_id JOIN place_partners pp ON pp.place_id=p.id
   WHERE p.id=$1 AND ${ELIGIBLE} AND ${OWNER} FOR UPDATE OF p,pp`,[initial.place_id,actor]);
  const {rows:[row]}=await client.query(`SELECT q.*,s.title,s.active FROM partner_service_requests q JOIN partner_services s ON s.id=q.service_id
   WHERE q.id=$1 AND (q.requester_id=$2 OR $3::boolean) FOR UPDATE OF q`,[serviceId(request),actor,Boolean(owner)]);
  if(!row)throw new AppError('Không tìm thấy yêu cầu.',404);
  if(Date.parse(row.starts_at)<=Date.now())throw new AppError('Khung giờ đã qua.',409);
  const customer=String(row.requester_id)===String(actor);
  let next=null;
  if(owner&&!customer&&row.status==='PENDING'&&action==='ACCEPT'&&row.active)next='ACCEPTED';
  if(owner&&!customer&&row.status==='PENDING'&&action==='DECLINE')next='DECLINED';
  if(action==='CANCEL'&&((customer&&['PENDING','ACCEPTED'].includes(row.status))||(owner&&row.status==='ACCEPTED')))next='CANCELLED';
  if(!next)throw new AppError('Trạng thái hoặc quyền không phù hợp.',409);
  const {rows:[updated]}=await client.query('UPDATE partner_service_requests SET status=$2,updated_at=now() WHERE id=$1 RETURNING *',[serviceId(request),next]);
  return mappedRequest({...updated,title:row.title});
 });
}
