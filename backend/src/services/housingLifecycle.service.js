import { pool, withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { invalidatePlaceBoundsCache } from './place.service.js';

export const PROPERTY_LIFETIME_DAYS = 30;

function money(value) {
  return value === null || value === undefined ? null : Number(value);
}

export async function listMyPropertyListings(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.slug, p.address, p.status AS place_status,
            p.updated_at, hl.listing_type, hl.listing_status, hl.expires_at,
            hl.last_confirmed_at, hl.property_type, hl.total_price_vnd,
            hl.monthly_rent, hl.area_m2
       FROM places p
       JOIN categories c ON c.id = p.category_id AND c.slug = 'bat-dong-san'
       JOIN housing_listings hl ON hl.place_id = p.id
      WHERE p.created_by = $1 AND hl.property_type IS NOT NULL
      ORDER BY p.created_at DESC LIMIT 100`,
    [userId]
  );

  return rows.map(row => ({
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
    areaM2: money(row.area_m2)
  }));
}

export async function managePropertyListing(placeId, actor, action) {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT p.id, p.created_by, p.status AS place_status,
              hl.listing_type, hl.listing_status, hl.expires_at
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
      if (row.listing_status !== 'ACTIVE' || row.place_status !== 'PUBLISHED') {
        throw new AppError('Tin đã ẩn hoặc kết thúc, cần gửi yêu cầu đăng lại.', 409);
      }
      await client.query(
        `UPDATE housing_listings SET
           last_confirmed_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days',
           updated_at = NOW()
         WHERE place_id = $1`,
        [placeId]
      );
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
