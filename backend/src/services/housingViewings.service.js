import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

function validId(value) {
  const raw=String(value);
  if (!/^[1-9]\d{0,14}$/.test(raw)) throw new AppError('Mã yêu cầu không hợp lệ.',400);
  return raw;
}
export function validateViewingTime(value, now=Date.now()) {
  const timestamp=Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value ||
      timestamp % 1800000 !== 0 || timestamp < now + 1800000 ||
      timestamp > now + 30*86400000) {
    throw new AppError('Chọn giờ tròn hoặc nửa giờ, từ 30 phút đến 30 ngày tới.',400);
  }
  return value;
}
function mapped(row, actor) {
  const incoming=String(row.recipient_id)===String(actor);
  const future=new Date(row.starts_at).getTime()>Date.now();
  const open=row.status==='PENDING'||row.status==='ACCEPTED';
  return {id:String(row.id),placeId:String(row.place_id),listingName:row.listing_name,
    startsAt:row.starts_at,createdAt:row.created_at,
    direction:incoming?'INCOMING':'OUTGOING',
    status:open&&!future?'PAST':open&&row.listing_available===false?'UNAVAILABLE':row.status,
    canAccept:incoming&&future&&row.listing_available!==false&&row.status==='PENDING',
    canDecline:incoming&&future&&row.status==='PENDING',
    canCancel:future&&(row.status==='ACCEPTED'||(!incoming&&row.status==='PENDING'))};
}
// Listing/recipient eligibility is checked again at creation and acceptance.
// Imported and DEMO places never route a request to an unrelated admin.
const AVAILABLE = `p.status='PUBLISHED' AND p.source IN ('USER','CTV')
  AND p.external_source IS NULL AND p.created_by IS NOT NULL
  AND hl.property_type IS NOT NULL AND hl.listing_status='ACTIVE'
  AND (hl.expires_at IS NULL OR hl.expires_at>NOW())
  AND (hl.listing_type='SALE' OR hl.availability_status<>'FULL')
  AND EXISTS(SELECT 1 FROM users u WHERE u.id=p.created_by AND u.account_status='ACTIVE')`;

export async function createHousingViewing(placeId,actorId,startsAt) {
  const id=validId(placeId);
  const slot=validateViewingTime(startsAt);
  try {
    return await withTransaction(async client=>{
      // Serialize submissions by each requester, then lock listing in the
      // same order as the lifecycle service. No phone/email is copied.
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[actorId]);
      const {rows:[listing]}=await client.query(
        `SELECT p.id,p.name,p.created_by FROM places p
           JOIN categories c ON c.id=p.category_id AND c.slug='bat-dong-san'
           JOIN housing_listings hl ON hl.place_id=p.id
          WHERE p.id=$1 AND ${AVAILABLE} FOR UPDATE OF p,hl`,[id]);
      if(!listing)throw new AppError('Tin này chưa nhận lịch xem hoặc không còn hiệu lực.',404);
      if(String(listing.created_by)===String(actorId))throw new AppError('Không thể đặt lịch với tin của chính bạn.',409);
      const {rows:[counts]}=await client.query(
        `SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE place_id=$2)::int AS same_place
           FROM housing_viewing_requests WHERE requester_id=$1
            AND starts_at>NOW() AND status IN ('PENDING','ACCEPTED')`,[actorId,id]);
      if(counts.total>=10||counts.same_place>0)throw new AppError('Bạn đã có lịch đang chờ cho tin này hoặc đạt giới hạn 10 lịch.',409);
      const {rows:[saved]}=await client.query(
        `INSERT INTO housing_viewing_requests(place_id,requester_id,recipient_id,listing_name,starts_at)
         VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,actorId,listing.created_by,listing.name,slot]);
      return mapped(saved,actorId);
    });
  } catch(error) {
    if(error.code==='23505')throw new AppError('Lịch này đã tồn tại.',409);
    throw error;
  }
}
export async function listHousingViewings(actorId) {
  const {rows}=await pool.query(
    `SELECT v.*,COALESCE((${AVAILABLE}) AND p.created_by=v.recipient_id,false) AS listing_available
       FROM housing_viewing_requests v JOIN places p ON p.id=v.place_id
       JOIN housing_listings hl ON hl.place_id=p.id
      WHERE v.requester_id=$1 OR v.recipient_id=$1
      ORDER BY (v.starts_at>NOW() AND v.status IN ('PENDING','ACCEPTED')) DESC,v.starts_at DESC,v.id DESC
      LIMIT 100`,[actorId]);
  return rows.map(row=>mapped(row,actorId));
}
export async function manageHousingViewing(viewingId,actorId,action) {
  const id=validId(viewingId);
  try {
    return await withTransaction(async client=>{
      // Acquire the canonical listing lock before the viewing lock (same as
      // closing a listing). Unauthorized actors cannot lock arbitrary rows.
      const {rows:[initial]}=await client.query(
        'SELECT place_id FROM housing_viewing_requests WHERE id=$1 AND (requester_id=$2 OR recipient_id=$2)',[id,actorId]);
      if(!initial)throw new AppError('Không tìm thấy yêu cầu.',404);
      const {rows:[listing]}=await client.query(
        `SELECT p.created_by,(${AVAILABLE}) AS available FROM places p
          JOIN categories c ON c.id=p.category_id AND c.slug='bat-dong-san'
          JOIN housing_listings hl ON hl.place_id=p.id WHERE p.id=$1 FOR UPDATE OF p,hl`,[initial.place_id]);
      const {rows:[row]}=await client.query(
        'SELECT * FROM housing_viewing_requests WHERE id=$1 AND (requester_id=$2 OR recipient_id=$2) FOR UPDATE',[id,actorId]);
      if(!row)throw new AppError('Không tìm thấy yêu cầu.',404);
      if(new Date(row.starts_at).getTime()<=Date.now())throw new AppError('Lịch đã qua giờ.',409);
      const incoming=String(row.recipient_id)===String(actorId);
      const available=Boolean(listing?.available)&&String(listing.created_by)===String(row.recipient_id);
      let next=null;
      if(action==='ACCEPT'&&incoming&&row.status==='PENDING'&&available)next='ACCEPTED';
      if(action==='DECLINE'&&incoming&&row.status==='PENDING')next='DECLINED';
      if(action==='CANCEL'&&(row.status==='ACCEPTED'||(!incoming&&row.status==='PENDING')))next='CANCELLED';
      if(!next)throw new AppError('Không thể thực hiện thao tác với trạng thái hoặc quyền hiện tại.',409);
      const {rows:[updated]}=await client.query(
        'UPDATE housing_viewing_requests SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *',[id,next]);
      return mapped({...updated,listing_available:available},actorId);
    });
  }catch(error){
    if(error.code==='23505')throw new AppError('Khung giờ này đã được xác nhận cho lịch khác.',409);
    throw error;
  }
}
