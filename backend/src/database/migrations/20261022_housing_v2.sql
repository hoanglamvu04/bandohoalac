-- Housing V2: structured rental inventory for HOLA Maps.
-- Kept separate from generic places so restaurant/cafe records stay lean.

CREATE TABLE IF NOT EXISTS housing_profiles (
  place_id BIGINT PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  monthly_rent INTEGER CHECK (monthly_rent IS NULL OR monthly_rent >= 0),
  deposit_amount INTEGER CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  room_area_m2 NUMERIC(7,2) CHECK (room_area_m2 IS NULL OR room_area_m2 > 0),
  available_rooms INTEGER CHECK (available_rooms IS NULL OR available_rooms >= 0),
  availability_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (availability_status IN ('AVAILABLE', 'LIMITED', 'FULL', 'UNKNOWN')),
  available_from DATE,
  property_type TEXT NOT NULL DEFAULT 'ROOM'
    CHECK (property_type IN ('ROOM', 'STUDIO', 'APARTMENT', 'WHOLE_HOUSE', 'DORM', 'OTHER')),
  max_occupants SMALLINT CHECK (max_occupants IS NULL OR max_occupants > 0),
  gender_policy TEXT NOT NULL DEFAULT 'ALL'
    CHECK (gender_policy IN ('ALL', 'MALE', 'FEMALE', 'UNKNOWN')),
  electricity_price_per_kwh INTEGER
    CHECK (electricity_price_per_kwh IS NULL OR electricity_price_per_kwh >= 0),
  water_price_per_person INTEGER
    CHECK (water_price_per_person IS NULL OR water_price_per_person >= 0),
  service_fee_monthly INTEGER
    CHECK (service_fee_monthly IS NULL OR service_fee_monthly >= 0),
  parking_fee_monthly INTEGER
    CHECK (parking_fee_monthly IS NULL OR parking_fee_monthly >= 0),
  amenities TEXT[] NOT NULL DEFAULT '{}',
  furnishings TEXT[] NOT NULL DEFAULT '{}',
  rules TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  verified_at TIMESTAMPTZ,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS housing_profiles_availability_idx
  ON housing_profiles (availability_status, monthly_rent);

CREATE INDEX IF NOT EXISTS housing_profiles_price_idx
  ON housing_profiles (monthly_rent);

CREATE INDEX IF NOT EXISTS housing_profiles_amenities_gin_idx
  ON housing_profiles USING GIN (amenities);

-- Existing real-estate places immediately become eligible for Housing V2 without
-- fabricating price/availability data. Owners can fill these fields in Partner.
INSERT INTO housing_profiles (place_id, availability_status, property_type)
SELECT p.id, 'UNKNOWN', 'ROOM'
FROM places p
JOIN categories c ON c.id = p.category_id
WHERE c.slug = 'bat-dong-san'
ON CONFLICT (place_id) DO NOTHING;
