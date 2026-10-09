import { client } from './api.js';

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function unwrap(promise) {
  return promise.then((response) => response.data).catch((error) => {
    if (error?.code === 'ERR_CANCELED') {
      const cancelled = new Error('Request cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    const wrapped = new Error(error?.response?.data?.error || error?.message || 'Không tải được HALO HOLA.');
    wrapped.status = error?.response?.status;
    throw wrapped;
  });
}

export function getHaloSpots(bounds = {}, options = {}) {
  return unwrap(client.get('/halo/v1/spots', {
    params: cleanParams(bounds),
    signal: options.signal
  }));
}

export function getHaloSpot(id, options = {}) {
  return unwrap(client.get('/halo/v1/spots/' + encodeURIComponent(id), {
    params: cleanParams({ limit: options.limit || 80 }),
    signal: options.signal
  }));
}

export function getHaloPlaceMedia(placeId, options = {}) {
  return unwrap(client.get('/halo/v1/places/' + encodeURIComponent(placeId), {
    params: cleanParams({ limit: options.limit || 80 }),
    signal: options.signal
  }));
}
