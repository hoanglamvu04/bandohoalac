import { client } from './api.js';

function unwrap(promise) {
  return promise
    .then((response) => response.data)
    .catch((error) => {
      const message = error.response?.data?.error || error.message || 'Đã có lỗi xảy ra.';
      const wrapped = new Error(message);
      wrapped.status = error.response?.status;
      throw wrapped;
    });
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function getPhotoCandidates(params = {}) {
  return unwrap(client.get('/admin/photo-scanner', { params: cleanParams(params) }));
}

export function getPhotoScannerStats() {
  return unwrap(client.get('/admin/photo-scanner/stats'));
}

export function getPhotoScanRuns(params = {}) {
  return unwrap(client.get('/admin/photo-scanner/runs', { params: cleanParams(params) }));
}

export function startPhotoScan(payload = {}) {
  return unwrap(client.post('/admin/photo-scanner/scan', payload));
}

export function approvePhotoCandidate(id, payload = {}) {
  return unwrap(client.post('/admin/photo-scanner/' + encodeURIComponent(id) + '/approve', payload));
}

export function rejectPhotoCandidate(id) {
  return unwrap(client.post('/admin/photo-scanner/' + encodeURIComponent(id) + '/reject'));
}
