import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING, isInsideServiceCoverage } from '../config/mapCoverage.js';
import {
  buildTripDistanceMatrix,
  buildTripEstimatedDurationMatrix,
  optimizeTripOrder
} from '../utils/tripOptimization.js';

const SUPPORTED_PROFILES = new Set(['driving']);

async function getRouteHazards(geometry) {
  if (!geometry?.coordinates?.length) return { items: [], available: false };

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
         mf.properties,
         ST_AsGeoJSON(
           ST_Intersection(
             mf.geometry,
             ST_Buffer(route.geom::geography, 40)::geometry
           )
         )::json AS geometry
       FROM map_features mf, route, service_area
       WHERE mf.status = 'ACTIVE'
         AND mf.layer_type IN ('FLOOD', 'ROAD_CLOSURE', 'ALERT')
         AND (mf.valid_from IS NULL OR mf.valid_from <= NOW())
         AND (mf.valid_until IS NULL OR mf.valid_until >= NOW())
         AND ST_DWithin(mf.geometry::geography, route.geom::geography, 40)
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

    return {
      available: true,
      items: rows.map((row) => ({
        id: String(row.id),
        type: row.layer_type,
        name: row.name,
        severity: row.severity || 'INFO',
        ...(row.properties || {}),
        geometry: row.geometry || null
      }))
    };
  } catch (error) {
    // Keep routing available even before the optional map_features migration
    // has been applied on an older development database.
    if (error?.code === '42P01') return { items: [], available: false };
    console.error('[Hola Maps] Hazard lookup failed:', error);
    return { items: [], available: false };
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
    const hazardResult = await getRouteHazards(route.geometry);

    return {
      provider: 'OSRM',
      profile,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destinationLat, lng: destinationLng },
      distanceMeters: Math.round(Number(route.distance) || 0),
      durationSeconds: Math.round(Number(route.duration) || 0),
      geometry: route.geometry,
      steps,
      hazards: hazardResult.items,
      hazardCheckAvailable: hazardResult.available
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

async function requestOsrmJson(url, timeoutMessage = 'Routing request timed out.') {
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
    if (data.code !== 'Ok') {
      throw new AppError(data.message || 'Routing provider could not calculate this request.', 422);
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new AppError(timeoutMessage, 504);
    if (error instanceof AppError) throw error;
    throw new AppError('Could not connect to the routing provider.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function routeCoordinates(stops) {
  return stops.map((stop) => Number(stop.lng) + ',' + Number(stop.lat)).join(';');
}

export async function getTripDirections({
  stops = [],
  optimize = false,
  profile = 'driving'
} = {}) {
  if (!SUPPORTED_PROFILES.has(profile)) {
    throw new AppError('Unsupported routing profile.', 400);
  }
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 12) {
    throw new AppError('A trip must contain between 2 and 12 stops.', 400);
  }

  const normalizedStops = stops.map((stop, index) => ({
    id: stop.id ? String(stop.id) : String(index + 1),
    name: String(stop.name || ('Điểm ' + (index + 1))).trim(),
    lat: Number(stop.lat),
    lng: Number(stop.lng)
  }));

  for (const stop of normalizedStops) {
    if (
      !Number.isFinite(stop.lat) ||
      !Number.isFinite(stop.lng) ||
      !isInsideServiceCoverage(stop.lng, stop.lat)
    ) {
      throw new AppError('All trip stops must be inside the Hola Maps service area.', 400);
    }
  }

  let orderedIndexes = normalizedStops.map((_, index) => index);
  let optimizationMethod = optimize ? 'distance-estimate' : 'manual';
  const baseUrl = env.routingBaseUrl.replace(/\/$/, '');

  if (optimize && normalizedStops.length > 2) {
    try {
      const tableUrl = new URL(
        baseUrl + '/table/v1/' + profile + '/' + routeCoordinates(normalizedStops)
      );
      tableUrl.searchParams.set('annotations', 'duration');
      const tableData = await requestOsrmJson(
        tableUrl,
        'Trip optimization request timed out.'
      );

      if (
        Array.isArray(tableData.durations) &&
        tableData.durations.length === normalizedStops.length
      ) {
        orderedIndexes = optimizeTripOrder(normalizedStops, tableData.durations);
        optimizationMethod = 'osrm-duration-matrix';
      } else {
        orderedIndexes = optimizeTripOrder(
          normalizedStops,
          buildTripEstimatedDurationMatrix(normalizedStops)
        );
      }
    } catch (error) {
      // The route engine can still provide a complete itinerary when its
      // optional table service is disabled: use geodesic distance as fallback.
      console.warn('[Hola Maps] OSRM table optimization unavailable; using distance estimate.', error.message);
      orderedIndexes = optimizeTripOrder(
        normalizedStops,
        buildTripEstimatedDurationMatrix(normalizedStops)
      );
      optimizationMethod = 'distance-estimate';
    }
  }

  const orderedStops = orderedIndexes.map((index, orderIndex) => ({
    ...normalizedStops[index],
    order: orderIndex + 1
  }));
  const coordinates = routeCoordinates(orderedStops);
  const routeUrl = new URL(baseUrl + '/route/v1/' + profile + '/' + coordinates);
  routeUrl.searchParams.set('overview', 'full');
  routeUrl.searchParams.set('geometries', 'geojson');
  routeUrl.searchParams.set('steps', 'true');
  routeUrl.searchParams.set('alternatives', 'false');

  const data = await requestOsrmJson(routeUrl);
  if (!Array.isArray(data.routes) || !data.routes.length) {
    throw new AppError('No route found for these stops.', 404);
  }

  const route = data.routes[0];
  const legs = (route.legs || []).map((leg, index) => ({
    index,
    fromStop: orderedStops[index] || null,
    toStop: orderedStops[index + 1] || null,
    distanceMeters: Math.round(Number(leg.distance) || 0),
    durationSeconds: Math.round(Number(leg.duration) || 0),
    steps: (leg.steps || []).map(normalizeStep)
  }));
  const steps = legs.flatMap((leg) => leg.steps);
  const hazardResult = await getRouteHazards(route.geometry);

  return {
    provider: 'OSRM',
    profile,
    optimizationMethod,
    optimized: Boolean(optimize),
    stops: orderedStops,
    origin: orderedStops[0],
    destination: orderedStops[orderedStops.length - 1],
    distanceMeters: Math.round(Number(route.distance) || 0),
    durationSeconds: Math.round(Number(route.duration) || 0),
    geometry: route.geometry,
    legs,
    steps,
    hazards: hazardResult.items,
    hazardCheckAvailable: hazardResult.available
  };
}
