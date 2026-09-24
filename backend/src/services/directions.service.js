import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING, isInsideServiceCoverage } from '../config/mapCoverage.js';

const SUPPORTED_PROFILES = new Set(['driving']);

async function getRouteHazards(geometry) {
  if (!geometry?.coordinates?.length) return [];

  try {
    const { rows } = await pool.query(
      `WITH route AS (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
       ),
       service_area AS (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) AS geom
       )
       SELECT
         mf.id,
         mf.layer_type,
         mf.name,
         mf.severity,
         mf.properties
       FROM map_features mf, route, service_area
       WHERE mf.status = 'ACTIVE'
         AND mf.layer_type IN ('FLOOD', 'ROAD_CLOSURE', 'ALERT')
         AND (mf.valid_from IS NULL OR mf.valid_from <= NOW())
         AND (mf.valid_until IS NULL OR mf.valid_until >= NOW())
         AND ST_Intersects(mf.geometry, route.geom)
         AND ST_Intersects(mf.geometry, service_area.geom)
       ORDER BY
         CASE mf.severity
           WHEN 'CRITICAL' THEN 5
           WHEN 'HIGH' THEN 4
           WHEN 'MEDIUM' THEN 3
           WHEN 'LOW' THEN 2
           ELSE 1
         END DESC
       LIMIT 50`,
      [JSON.stringify(geometry), SERVICE_AREA_GEOJSON_STRING]
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.layer_type,
      name: row.name,
      severity: row.severity || 'INFO',
      ...(row.properties || {})
    }));
  } catch (error) {
    // Keep routing available even before the optional map_features migration
    // has been applied on an older development database.
    if (error?.code === '42P01') return [];
    console.error('[Hola Maps] Hazard lookup failed:', error);
    return [];
  }
}

function normalizeStep(step) {
  return {
    name: step.name || '',
    distanceMeters: Math.round(Number(step.distance) || 0),
    durationSeconds: Math.round(Number(step.duration) || 0),
    maneuver: {
      type: step.maneuver?.type || 'continue',
      modifier: step.maneuver?.modifier || null,
      bearingBefore: step.maneuver?.bearing_before ?? null,
      bearingAfter: step.maneuver?.bearing_after ?? null,
      location: Array.isArray(step.maneuver?.location)
        ? { lng: Number(step.maneuver.location[0]), lat: Number(step.maneuver.location[1]) }
        : null
    }
  };
}

export async function getDirections({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  profile = 'driving'
}) {
  if (!SUPPORTED_PROFILES.has(profile)) {
    throw new AppError('Unsupported routing profile.', 400);
  }

  if (!isInsideServiceCoverage(destinationLng, destinationLat)) {
    throw new AppError('Destination is outside the Hola Maps service area.', 400);
  }

  const baseUrl = env.routingBaseUrl.replace(/\/$/, '');
  const coordinates =
    originLng + ',' + originLat + ';' + destinationLng + ',' + destinationLat;

  const url = new URL(baseUrl + '/route/v1/' + profile + '/' + coordinates);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('alternatives', 'false');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.routingTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HolaMaps/1.0'
      }
    });

    if (!response.ok) {
      throw new AppError('Routing provider is unavailable.', 502);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes.length) {
      throw new AppError('No route found for these locations.', 404);
    }

    const route = data.routes[0];
    const steps = route.legs?.flatMap((leg) => leg.steps || []).map(normalizeStep) || [];
    const hazards = await getRouteHazards(route.geometry);

    return {
      provider: 'OSRM',
      profile,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destinationLat, lng: destinationLng },
      distanceMeters: Math.round(Number(route.distance) || 0),
      durationSeconds: Math.round(Number(route.duration) || 0),
      geometry: route.geometry,
      steps,
      hazards
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AppError('Routing request timed out.', 504);
    }

    if (error instanceof AppError) throw error;

    console.error('[Hola Maps] Routing provider error:', error);
    throw new AppError('Could not calculate directions.', 502);
  } finally {
    clearTimeout(timeout);
  }
}
