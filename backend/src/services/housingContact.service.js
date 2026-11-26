import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

// Contact details are intentionally absent from public place/housing JSON.
// This service is only called behind authenticated, per-account rate limiting.
export async function getHousingContactForMember(placeId, db = pool) {
  const id = Number(placeId);
  if (!Number.isSafeInteger(id) || id <= 0 || String(placeId).length > 15) {
    throw new AppError('Mã bất động sản không hợp lệ.', 400);
  }

  const { rows } = await db.query(
    `SELECT p.phone, p.external_source, hl.contact_name, hl.contact_zalo
       FROM places p
       JOIN categories c ON c.id = p.category_id AND c.slug = 'bat-dong-san'
       JOIN housing_listings hl ON hl.place_id = p.id
      WHERE p.id = $1
        AND p.status = 'PUBLISHED'
        AND hl.listing_status = 'ACTIVE'
        AND (hl.expires_at IS NULL OR hl.expires_at > NOW())
      LIMIT 1`,
    [id]
  );
  if (!rows.length) throw new AppError('Tin bất động sản không còn công khai.', 404);

  const row = rows[0];
  const isDemo = row.external_source === 'HOLA_THACH_THAT_DEMO_2026';
  return {
    contactName: row.contact_name || null,
    phone: isDemo ? null : (String(row.phone || '').trim() || null),
    zalo: isDemo ? null : (String(row.contact_zalo || '').trim() || null),
    isDemo
  };
}
