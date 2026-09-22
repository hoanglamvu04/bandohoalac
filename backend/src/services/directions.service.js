import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const SUPPORTED_PROFILES = new Set(['driving']);

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

    return {
      provider: 'OSRM',
      profile,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destinationLat, lng: destinationLng },
      distanceMeters: Math.round(Number(route.distance) || 0),
      durationSeconds: Math.round(Number(route.duration) || 0),
      geometry: route.geometry,
      steps
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
