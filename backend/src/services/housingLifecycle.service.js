import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { invalidatePlaceBoundsCache } from './place.service.js';
import { decodeOwnerListingCursor, encodeOwnerListingCursor, ownerListingPageLimit } from '../lib/ownerListingCursor.js';

export const PROPERTY_LIFETIME_DAYS = 30;

function money(value) {
  return value === null || value === undefined ? null : Number(value);
}

const OWNER_LISTING_SELECT = `SELECT p.id, p.name, p.slug, p.address, p.status AS place_status,
            to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
            p.updated_at, hl.listing_type, hl.listing_status, hl.expires_at,
            hl.last_confirmed_at, hl.property_type, hl.total_price_vnd,
            hl.monthly_rent, hl.area_m2, hl.available_rooms, hl.total_rooms,jsonb_array_length(hl.room_types) AS room_type_count,
            v.viewing_requests_30d,v.accepted_viewings_30d,
            m.detail_views_30d,m.contact_reveals_30d
       FROM places p
       JOIN categories c ON c.id = p.category_id AND c.slug = 'bat-dong-san'
       JOIN housing_listings hl ON hl.place_id = p.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS viewing_requests_30d,
                COUNT(*) FILTER (WHERE vr.status='ACCEPTED')::int AS accepted_viewings_30d
         FROM housing_viewing_requests vr
         WHERE vr.place_id=p.id AND vr.recipient_id=$1 AND vr.created_at>=NOW()-INTERVAL '30 days'
       ) v ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(dm.detail_views),0) AS detail_views_30d,
                COALESCE(SUM(dm.contact_reveals),0) AS contact_reveals_30d
         FROM housing_daily_metrics dm
         WHERE dm.place_id=p.id AND dm.metric_day>=(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-29
       ) m ON TRUE
      WHERE p.created_by = $1 AND hl.property_type IS NOT NULL`;
const OWNER_LISTING_ORDER=' ORDER BY p.created_at DESC,p.id DESC';

function mapOwnerListing(row){
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    address: row.address,
    placeStatus: row.place_status,
    updatedAt: row.updated_at,
    listingType: row.listing_type,
    listingStatus: row.listing_status,
    expiresAt: row.expires_at,
    lastConfirmedAt: row.last_confirmed_at,
    propertyType: row.property_type,
    totalPriceVnd: money(row.total_price_vnd),
    monthlyRentVnd: money(row.monthly_rent),
    areaM2: money(row.area_m2),
    availableRooms: money(row.available_rooms),
    totalRooms: money(row.total_rooms),
    roomTypeCount:Number(row.room_type_count)||0,
    viewingRequests30d: Number(row.viewing_requests_30d)||0,
    acceptedViewings30d: Number(row.accepted_viewings_30d)||0,
    detailViews30d: Number(row.detail_views_30d)||0,
    contactReveals30d: Number(row.contact_reveals_30d)||0
  };
}

export async function listMyPropertyListings(userId, db = pool) {
  const {rows}=await db.query(OWNER_LISTING_SELECT+OWNER_LISTING_ORDER+' LIMIT 100',[userId]);
  return rows.map(mapOwnerListing);
}

export async function listMyPropertyListingsPage(userId,{limit=50,cursor}={},db=pool){
  const size=ownerListingPageLimit(limit);
  const args=[userId];
  let where='';
  if(cursor!==undefined){
    const boundary=decodeOwnerListingCursor(cursor);
    args.push(boundary.createdAt,boundary.id);
    where=' AND (p.created_at,p.id) < ($2::timestamptz,$3::bigint)';
  }
  args.push(size+1);
  const {rows}=await db.query(OWNER_LISTING_SELECT+where+OWNER_LISTING_ORDER+' LIMIT $'+args.length,args);
  const page=rows.slice(0,size),last=page.at(-1);
  return {items:page.map(mapOwnerListing),nextCursor:rows.length>size&&last?encodeOwnerListingCursor(last.cursor_created_at,last.id):null};
}

export async function managePropertyListing(placeId, actor, action, {availableRooms} = {}) {
  if (availableRooms !== undefined && (action !== 'CONFIRM_ACTIVE' || !Number.isInteger(availableRooms) || availableRooms < 0 || availableRooms > 10000)) throw new AppError('Số phòng trống không hợp lệ.',400);
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT p.id, p.created_by, p.status AS place_status,
              hl.listing_type, hl.listing_status, hl.expires_at, hl.total_rooms,jsonb_array_length(hl.room_types) AS room_type_count
         FROM places p
         JOIN categories c ON c.id = p.category_id AND c.slug = 'bat-dong-san'
         JOIN housing_listings hl ON hl.place_id = p.id
        WHERE p.id = $1 AND hl.property_type IS NOT NULL
        FOR UPDATE OF p, hl`,
      [placeId]
    );
    const row = rows[0];
    if (!row) throw new AppError('Không tìm thấy tin bất động sản.', 404);
    if (Number(row.created_by) !== Number(actor.id) &&
        !['ADMIN', 'MODERATOR'].includes(actor.role)) {
      throw new AppError('Bạn không có quyền quản lý tin bất động sản này.', 403);
    }

    if (action === 'CONFIRM_ACTIVE') {
      if(availableRooms!==undefined&&Number(row.room_type_count)>0)throw new AppError('Hãy gửi cập nhật theo từng loại phòng để duyệt.',409);
      if (row.listing_status !== 'ACTIVE' || row.place_status !== 'PUBLISHED') {
        throw new AppError('Tin đã ẩn hoặc kết thúc, cần gửi yêu cầu đăng lại.', 409);
      }
      if (availableRooms !== undefined && (row.listing_type !== 'RENT' ||
          (row.total_rooms !== null && availableRooms > Number(row.total_rooms)))) {
        throw new AppError('Số phòng trống không phù hợp với tin cho thuê.',400);
      }
      await client.query(
        `UPDATE housing_listings SET
           available_rooms=COALESCE($2::integer,available_rooms),
           availability_status=CASE WHEN $2::integer IS NULL THEN availability_status WHEN $2::integer=0 THEN 'FULL' ELSE 'AVAILABLE' END,
           last_confirmed_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days',
           updated_at = NOW()
         WHERE place_id = $1`,
        [placeId, availableRooms ?? null]
      );
      if (availableRooms === 0) await client.query(
        "UPDATE housing_viewing_requests SET status='CANCELLED',updated_at=NOW() WHERE place_id=$1 AND starts_at>NOW() AND status IN ('PENDING','ACCEPTED')",[placeId]);
      return { placeId: String(placeId), listingStatus: 'ACTIVE', action };
    }

    const target = {
      PAUSE: 'PAUSED',
      SOLD: 'SOLD',
      RENTED: 'RENTED'
    }[action];
    if (!target) throw new AppError('Thao tác không hợp lệ.', 400);
    if (row.listing_status !== 'ACTIVE' || row.place_status !== 'PUBLISHED') {
      throw new AppError('Tin đã được ẩn hoặc kết thúc.', 409);
    }
    if ((target === 'SOLD' && row.listing_type !== 'SALE') ||
        (target === 'RENTED' && row.listing_type !== 'RENT')) {
      throw new AppError('Trạng thái giao dịch không phù hợp với tin.', 400);
    }

    await client.query(
      'UPDATE housing_listings SET listing_status = $1, updated_at = NOW() WHERE place_id = $2',
      [target, placeId]
    );
    await client.query("UPDATE housing_viewing_requests SET status='CANCELLED',updated_at=NOW() WHERE place_id=$1 AND starts_at>NOW() AND status IN ('PENDING','ACCEPTED')",[placeId]);
    // Archiving the canonical place hides it from *all* public map endpoints,
    // not just the dedicated Housing API.
    await client.query(
      "UPDATE places SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1",
      [placeId]
    );
    return { placeId: String(placeId), listingStatus: target, action };
  });

  invalidatePlaceBoundsCache();
  return result;
}
