import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5003/api').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'hola_maps_token';

export const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors (private mode, blocked storage, etc.)
  }
}

function unwrap(promise) {
  return promise.then((res) => res.data).catch((error) => {
    const message = error.response?.data?.error || error.message || 'Đã có lỗi xảy ra.';
    throw new Error(message);
  });
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export function register(payload) {
  return unwrap(client.post('/auth/register', payload));
}

export function login(payload) {
  return unwrap(client.post('/auth/login', payload));
}

export function getMe() {
  return unwrap(client.get('/auth/me'));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export function getCategories() {
  return unwrap(client.get('/categories'));
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------
export function getPlaces(params = {}) {
  return unwrap(client.get('/places', { params: cleanParams(params) }));
}

export function getPlace(id) {
  return unwrap(client.get(\`/places/\${encodeURIComponent(id)}\`));
}

export function getPlaceBySlug(slug) {
  return unwrap(client.get(\`/places/slug/\${encodeURIComponent(slug)}\`));
}

export function getNearbyPlaces(lat, lng, radius = 5000) {
  return unwrap(client.get('/places/nearby', { params: { lat, lng, radius } }));
}

export function getPlacesInBounds(bounds) {
  return unwrap(client.get('/places/bounds', { params: bounds }));
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------
export function createContribution({ type, placeId, location, place, reason, photos = [] }) {
  const formData = new FormData();
  formData.append('type', type);
  if (placeId) formData.append('placeId', String(placeId));
  if (location) formData.append('location', JSON.stringify(location));
  if (place) formData.append('place', JSON.stringify(place));
  if (reason) formData.append('reason', reason);
  photos.forEach((file) => formData.append('photos', file));

  return unwrap(client.post('/contributions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }));
}

export function getMyContributions() {
  return unwrap(client.get('/contributions/me'));
}

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------
export function getAdminContributions(params = {}) {
  return unwrap(client.get('/admin/contributions', { params: cleanParams(params) }));
}

export function getAdminContribution(id) {
  return unwrap(client.get(\`/admin/contributions/\${encodeURIComponent(id)}\`));
}

export function approveContribution(id) {
  return unwrap(client.post(\`/admin/contributions/\${encodeURIComponent(id)}/approve\`));
}

export function rejectContribution(id, reason) {
  return unwrap(client.post(\`/admin/contributions/\${encodeURIComponent(id)}/reject\`, { reason }));
}

// ---------------------------------------------------------------------------
// Users & leaderboard
// ---------------------------------------------------------------------------
export function getUserProfile(id) {
  return unwrap(client.get(\`/users/\${encodeURIComponent(id)}/profile\`));
}

export function getLeaderboard(limit = 20) {
  return unwrap(client.get('/leaderboard', { params: { limit } }));
}

export { API_URL };
