const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Request failed: ' + response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function getPlaces(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  return request('/places' + (query.toString() ? '?' + query.toString() : ''));
}

export function getPlace(id) {
  return request('/places/' + encodeURIComponent(id));
}

export function getNearbyPlaces(lat, lng, radius = 5000) {
  const query = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
  return request('/places/nearby?' + query.toString());
}

export function createContribution(payload) {
  return request('/contributions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export { API_URL };
