CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS places_location_extension (
  place_id uuid PRIMARY KEY,
  location geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS places_location_gist_idx
ON places_location_extension
USING GIST(location);
