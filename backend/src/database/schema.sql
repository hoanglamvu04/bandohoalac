CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS places (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT,
 description TEXT,
 rating NUMERIC DEFAULT 0,
 location geometry(Point,4326),
 created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS places_location_idx
ON places USING GIST(location);

CREATE TABLE IF NOT EXISTS contributions (
 id SERIAL PRIMARY KEY,
 place_id INTEGER REFERENCES places(id),
 contributor_name TEXT,
 latitude DOUBLE PRECISION,
 longitude DOUBLE PRECISION,
 accuracy INTEGER,
 points INTEGER DEFAULT 0,
 created_at TIMESTAMP DEFAULT NOW()
);
