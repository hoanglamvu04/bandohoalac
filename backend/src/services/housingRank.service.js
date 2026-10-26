// HOLA Rank for housing: organic relevance, not commercial placement.
// Availability verified within 30 days is the first sort key. Within each
// availability band, use the same 0-100 score that is shown to visitors.
// No is_partner, advertisement, campaign or payment column affects ranking.
export const HOUSING_AVAILABILITY_FRESH_DAYS = 30;

export const HOUSING_RANK_LATERAL_SQL = String.raw\`
  CROSS JOIN LATERAL (
    SELECT ROUND(ST_Distance(
      p.location::geography,
      ST_SetSRID(ST_MakePoint(105.52522, 21.01354), 4326)::geography
    ))::int AS distance_m
  ) fpt
  CROSS JOIN LATERAL (
    SELECT
      (
        hl.last_verified_at >= NOW() - INTERVAL '30 days'
        AND hl.last_verified_at <= NOW()
      ) AS is_recent,
      CASE
        WHEN hl.last_verified_at IS NULL
          OR hl.last_verified_at < NOW() - INTERVAL '30 days'
          OR hl.last_verified_at > NOW()
          THEN 'UNKNOWN'
        WHEN hl.availability_status IN ('AVAILABLE', 'LIMITED')
          AND hl.available_rooms = 0
          THEN 'UNKNOWN'
        WHEN hl.availability_status = 'FULL'
          AND hl.available_rooms > 0
          THEN 'UNKNOWN'
        ELSE COALESCE(hl.availability_status, 'UNKNOWN')
      END AS effective_status
  ) availability
  CROSS JOIN LATERAL (
    SELECT (
      CASE availability.effective_status
        WHEN 'AVAILABLE' THEN 40
        WHEN 'LIMITED' THEN 28
        WHEN 'UNKNOWN' THEN 6
        ELSE 0
      END
      + CASE
        WHEN hl.last_verified_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() THEN 20
        WHEN hl.last_verified_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() THEN 13
        WHEN hl.last_verified_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() THEN 6
        ELSE 0
      END
      + CASE WHEN hl.monthly_rent > 0 THEN 8 ELSE 0 END
      + CASE WHEN hl.area_m2 > 0 THEN 6 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(p.phone, '')), '') IS NOT NULL
                     OR NULLIF(BTRIM(COALESCE(hl.contact_zalo, '')), '') IS NOT NULL
             THEN 5 ELSE 0 END
      + CASE WHEN EXISTS (
          SELECT 1 FROM place_images img WHERE img.place_id = p.id
        ) THEN 7 ELSE 0 END
      + CASE WHEN NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NOT NULL
             THEN 4 ELSE 0 END
      + CASE
        WHEN fpt.distance_m <= 1500 THEN 8
        WHEN fpt.distance_m <= 3000 THEN 5
        WHEN fpt.distance_m <= 5000 THEN 3
        ELSE 0
      END
      + CASE WHEN availability.is_recent THEN
          CASE hl.verification_source
            WHEN 'ADMIN' THEN 2
            WHEN 'PARTNER' THEN 2
            WHEN 'COMMUNITY' THEN 1
            ELSE 0
          END
        ELSE 0 END
    )::int AS score
  ) housing_rank
\`;

export const HOUSING_RANK_ORDER_SQL = String.raw\`
  CASE availability.effective_status
    WHEN 'AVAILABLE' THEN 0
    WHEN 'LIMITED' THEN 1
    WHEN 'UNKNOWN' THEN 2
    ELSE 3
  END ASC,
  housing_rank.score DESC,
  hl.last_verified_at DESC NULLS LAST,
  p.id ASC
\`;

export const HOUSING_RANK_META = Object.freeze({
  version: 'housing-v3',
  mode: 'organic',
  freshnessDays: HOUSING_AVAILABILITY_FRESH_DAYS,
  paidBoost: false,
  description: 'Ưu tiên tình trạng phòng còn hiệu lực, sau đó điểm độ mới, độ đầy đủ, khoảng cách FPT và nguồn xác minh. Đối tác trả phí không được ưu tiên thứ hạng.'
});

export function mapHousingRank(row) {
  if (!row) return null;

  const status = row.effective_availability_status || 'UNKNOWN';
  const verifiedRecently = row.availability_is_recent === true;
  const score = Number(row.hola_rank_score) || 0;
  const signals = [];

  if (status === 'AVAILABLE') signals.push('Còn phòng · xác minh trong 30 ngày');
  else if (status === 'LIMITED') signals.push('Sắp hết phòng · xác minh trong 30 ngày');
  else if (status === 'FULL') signals.push('Hiện hết phòng');
  else signals.push('Tình trạng phòng chưa được xác minh gần đây');

  if (verifiedRecently) signals.push('Dữ liệu phòng được cập nhật gần đây');
  if (Number(row.monthly_rent) > 0) signals.push('Có giá thuê rõ ràng');
  else signals.push('Chưa công khai giá thuê');

  if (Number(row.area_m2) > 0) signals.push('Có thông tin diện tích');
  if (Array.isArray(row.images) && row.images.length) signals.push('Có ảnh địa điểm');
  else signals.push('Chưa có ảnh địa điểm');

  if (Number(row.distance_to_fpt_m) <= 3000) signals.push('Trong phạm vi 3 km từ ĐH FPT');

  return {
    version: HOUSING_RANK_META.version,
    mode: HOUSING_RANK_META.mode,
    score,
    verifiedRecently,
    effectiveAvailabilityStatus: status,
    signals
  };
}
