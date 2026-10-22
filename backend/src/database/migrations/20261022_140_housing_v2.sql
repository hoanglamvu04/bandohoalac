-- Housing V2: structured room-rental data linked one-to-one with map places.
-- Re-runnable because this repository reapplies migrations on deploy.

CREATE TABLE IF NOT EXISTS housing_listings (
  place_id BIGINT PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  monthly_rent INTEGER CHECK (monthly_rent IS NULL OR monthly_rent >= 0),
  deposit_amount INTEGER CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  area_m2 NUMERIC(7, 2) CHECK (area_m2 IS NULL OR area_m2 > 0),
  availability_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (availability_status IN ('AVAILABLE', 'LIMITED', 'FULL', 'UNKNOWN')),
  available_rooms INTEGER CHECK (available_rooms IS NULL OR available_rooms >= 0),
  total_rooms INTEGER CHECK (total_rooms IS NULL OR total_rooms >= 0),
  electricity_price_per_kwh INTEGER
    CHECK (electricity_price_per_kwh IS NULL OR electricity_price_per_kwh >= 0),
  water_price_per_person_month INTEGER
    CHECK (water_price_per_person_month IS NULL OR water_price_per_person_month >= 0),
  parking_fee_monthly INTEGER
    CHECK (parking_fee_monthly IS NULL OR parking_fee_monthly >= 0),
  has_air_conditioner BOOLEAN,
  has_water_heater BOOLEAN,
  has_private_bathroom BOOLEAN,
  has_loft BOOLEAN,
  has_balcony BOOLEAN,
  has_parking BOOLEAN,
  allows_pets BOOLEAN,
  curfew_note TEXT,
  availability_note TEXT,
  contact_zalo TEXT,
  available_from DATE,
  last_verified_at TIMESTAMPTZ,
  verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verification_source TEXT NOT NULL DEFAULT 'COMMUNITY'
    CHECK (verification_source IN ('COMMUNITY', 'PARTNER', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS housing_listings_rent_idx
  ON housing_listings (monthly_rent);

CREATE INDEX IF NOT EXISTS housing_listings_area_idx
  ON housing_listings (area_m2);

CREATE INDEX IF NOT EXISTS housing_listings_availability_idx
  ON housing_listings (availability_status, available_rooms);

CREATE INDEX IF NOT EXISTS housing_listings_verified_idx
  ON housing_listings (last_verified_at DESC);

CREATE INDEX IF NOT EXISTS housing_listings_amenities_idx
  ON housing_listings (
    has_air_conditioner,
    has_water_heater,
    has_private_bathroom,
    has_parking
  );
