import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5003/api').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'hola_maps_token';

export const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = 'Bearer ' + token;
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
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
      const cancelled = new Error('Request cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }

    const message = error.response?.data?.error || error.message || 'Đã có lỗi xảy ra.';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.retryAfter = error.response?.headers?.['retry-after'];
    throw wrapped;
  });
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function register(payload) {
  return unwrap(client.post('/auth/register', payload));
}

export function login(payload) {
  return unwrap(client.post('/auth/login', payload));
}

export function getMe() {
  return unwrap(client.get('/auth/me'));
}

export function getCategories() {
  return unwrap(client.get('/categories'));
}

export function getPlaces(params = {}, options = {}) {
  return unwrap(client.get('/places', {
    params: cleanParams(params),
    signal: options.signal
  }));
}

export function getHomePlaceSections(limit = 8) {
  return unwrap(client.get('/places/home-sections', {
    params: { limit }
  }));
}

export function getFeaturedPlaces(limit = 4) {
  return unwrap(client.get('/places/featured', {
    params: { limit }
  }));
}

export function getPlace(id) {
  return unwrap(client.get('/places/' + encodeURIComponent(id)));
}

export function getPlaceBySlug(slug) {
  return unwrap(client.get('/places/slug/' + encodeURIComponent(slug)));
}

export function getNearbyPlaces(lat, lng, radius = 5000, filters = {}) {
  return unwrap(client.get('/places/nearby', {
    params: cleanParams({
      lat,
      lng,
      radius,
      category: filters.category,
      minRating: filters.minRating
    })
  }));
}

export function getPlacesInBounds(bounds, options = {}) {
  return unwrap(client.get('/places/bounds', {
    params: bounds,
    signal: options.signal
  }));
}

export function getDirections({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  profile = 'driving'
}) {
  return unwrap(client.get('/directions', {
    params: {
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      profile
    }
  }));
}

export function getMapLayers({ types = [], bounds } = {}, options = {}) {
  return unwrap(client.get('/map-layers', {
    params: cleanParams({
      types: Array.isArray(types) ? types.join(',') : types,
      west: bounds?.west,
      south: bounds?.south,
      east: bounds?.east,
      north: bounds?.north
    }),
    signal: options.signal
  }));
}

export function createMapLayerFeature(payload) {
  return unwrap(client.post('/map-layers', payload));
}

export function updateMapLayerFeature(id, payload) {
  return unwrap(client.patch('/map-layers/' + encodeURIComponent(id), payload));
}

export function archiveMapLayerFeature(id) {
  return unwrap(client.delete('/map-layers/' + encodeURIComponent(id)));
}

export function createContribution({ type, placeId, location, place, reason, photos = [] }) {
  const formData = new FormData();
  formData.append('type', type);
  if (placeId) formData.append('placeId', String(placeId));
  if (location) formData.append('location', JSON.stringify(location));
  if (place) formData.append('place', JSON.stringify(place));
  if (reason) formData.append('reason', reason);
  photos.forEach((file) => formData.append('photos', file));

  return unwrap(client.post('/contributions', formData));
}

export function getMyContributions() {
  return unwrap(client.get('/contributions/me'));
}

export function getAdminContributions(params = {}) {
  return unwrap(client.get('/admin/contributions', { params: cleanParams(params) }));
}

export function getAdminContribution(id) {
  return unwrap(client.get('/admin/contributions/' + encodeURIComponent(id)));
}

export function approveContribution(id) {
  return unwrap(client.post('/admin/contributions/' + encodeURIComponent(id) + '/approve'));
}

export function rejectContribution(id, reason) {
  return unwrap(client.post('/admin/contributions/' + encodeURIComponent(id) + '/reject', { reason }));
}

export function getUserProfile(id) {
  return unwrap(client.get('/users/' + encodeURIComponent(id) + '/profile'));
}

export function getLeaderboard(limit = 20, period = 'month') {
  return unwrap(client.get('/leaderboard', { params: { limit, period } }));
}

export function getPlaceReviews(id, params = {}) {
  return unwrap(client.get('/places/' + encodeURIComponent(id) + '/reviews', {
    params: cleanParams(params)
  }));
}

export function getPlaceMe(id) {
  return unwrap(client.get('/places/' + encodeURIComponent(id) + '/me'));
}

export function savePlaceReview(id, payload) {
  return unwrap(client.put('/places/' + encodeURIComponent(id) + '/review', payload));
}

export function deletePlaceReview(id) {
  return unwrap(client.delete('/places/' + encodeURIComponent(id) + '/review'));
}

export function addFavorite(id) {
  return unwrap(client.post('/places/' + encodeURIComponent(id) + '/favorite'));
}

export function removeFavorite(id) {
  return unwrap(client.delete('/places/' + encodeURIComponent(id) + '/favorite'));
}

export function getMyFavorites() {
  return unwrap(client.get('/places/favorites/me'));
}

export function getNotifications(params = {}) {
  return unwrap(client.get('/notifications', { params: cleanParams(params) }));
}

export function markNotificationRead(id) {
  return unwrap(client.post('/notifications/' + encodeURIComponent(id) + '/read'));
}

export function markAllNotificationsRead() {
  return unwrap(client.post('/notifications/read-all'));
}

export function getAdminPlaces(params = {}) {
  return unwrap(client.get('/admin/places', { params: cleanParams(params) }));
}

export function getAdminPlace(id) {
  return unwrap(client.get('/admin/places/' + encodeURIComponent(id)));
}

export function createAdminPlace(payload) {
  return unwrap(client.post('/admin/places', payload));
}

export function updateAdminPlace(id, payload) {
  return unwrap(client.patch('/admin/places/' + encodeURIComponent(id), payload));
}

export function archiveAdminPlace(id) {
  return unwrap(client.delete('/admin/places/' + encodeURIComponent(id)));
}

export function uploadAdminPlaceImages(id, photos = []) {
  const formData = new FormData();
  photos.forEach((file) => formData.append('photos', file));
  return unwrap(client.post('/admin/places/' + encodeURIComponent(id) + '/images', formData));
}

export function setAdminPlaceCover(id, imageId) {
  return unwrap(client.post(
    '/admin/places/' + encodeURIComponent(id) + '/images/' + encodeURIComponent(imageId) + '/cover'
  ));
}

export function deleteAdminPlaceImage(id, imageId) {
  return unwrap(client.delete(
    '/admin/places/' + encodeURIComponent(id) + '/images/' + encodeURIComponent(imageId)
  ));
}



export function getAdvertisements() {
  return unwrap(client.get('/ads'));
}

export function hideAdvertisementsToday() {
  return unwrap(client.post('/ads/hide-today'));
}

export function getAdminAdvertisements() {
  return unwrap(client.get('/admin/ads'));
}

export function createAdminAdvertisement(payload) {
  return unwrap(client.post('/admin/ads', payload));
}

export function updateAdminAdvertisement(id, payload) {
  return unwrap(client.patch('/admin/ads/' + encodeURIComponent(id), payload));
}

export function archiveAdminAdvertisement(id) {
  return unwrap(client.delete('/admin/ads/' + encodeURIComponent(id)));
}

export function uploadAdminAdvertisementImage(id, image) {
  const formData = new FormData();
  formData.append('image', image);
  return unwrap(client.post('/admin/ads/' + encodeURIComponent(id) + '/image', formData));
}



export function getAdminUsers(params = {}) {
  return unwrap(client.get('/admin/users', { params: cleanParams(params) }));
}

export function getAdminUser(id) {
  return unwrap(client.get('/admin/users/' + encodeURIComponent(id)));
}

export function updateAdminUser(id, payload) {
  return unwrap(client.patch('/admin/users/' + encodeURIComponent(id), payload));
}

export function adjustAdminUserWallet(id, payload) {
  return unwrap(client.post(
    '/admin/users/' + encodeURIComponent(id) + '/wallet-adjustments',
    payload
  ));
}

export function getAdminPartners(params = {}) {
  return unwrap(client.get('/admin/partners', { params: cleanParams(params) }));
}

export function createAdminPartner(payload) {
  return unwrap(client.post('/admin/partners', payload));
}

export function updateAdminPartner(id, payload) {
  return unwrap(client.patch('/admin/partners/' + encodeURIComponent(id), payload));
}

export function getAdminVouchers(params = {}) {
  return unwrap(client.get('/admin/vouchers', { params: cleanParams(params) }));
}

export function createAdminVoucher(payload) {
  return unwrap(client.post('/admin/vouchers', payload));
}

export function updateAdminVoucher(id, payload) {
  return unwrap(client.patch('/admin/vouchers/' + encodeURIComponent(id), payload));
}

export function getAdminVoucherRedemptions(params = {}) {
  return unwrap(client.get('/admin/voucher-redemptions', { params: cleanParams(params) }));
}

export function markAdminVoucherRedeemed(id) {
  return unwrap(client.post('/admin/voucher-redemptions/' + encodeURIComponent(id) + '/redeem'));
}

export function getRewards() {
  return unwrap(client.get('/rewards'));
}

export function getMyRewards() {
  return unwrap(client.get('/rewards/me'));
}

export function redeemReward(id) {
  return unwrap(client.post('/rewards/' + encodeURIComponent(id) + '/redeem'));
}

export { API_URL };
