import { client } from './api.js';

function unwrap(promise) {
  return promise.then((res) => res.data).catch((error) => {
    const message = error.response?.data?.error || error.message || 'Đã có lỗi xảy ra.';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    throw wrapped;
  });
}

export function getDataQuality(limit = 100) {
  return unwrap(client.get('/admin/data-quality', { params: { limit } }));
}

export function getPlaceRevisions(placeId, limit = 50) {
  return unwrap(client.get('/admin/places/' + encodeURIComponent(placeId) + '/revisions', {
    params: { limit }
  }));
}

export function verifyPlaceQuality(placeId) {
  return unwrap(client.post('/admin/places/' + encodeURIComponent(placeId) + '/verify-quality'));
}

export function rollbackPlaceRevision(placeId, revisionId, reason) {
  return unwrap(client.post(
    '/admin/places/' + encodeURIComponent(placeId) + '/revisions/' + encodeURIComponent(revisionId) + '/rollback',
    { reason }
  ));
}

export function auditCtvModeration(contributionId, verdict, note) {
  return unwrap(client.post(
    '/admin/contributions/' + encodeURIComponent(contributionId) + '/ctv-audit',
    { verdict, note }
  ));
}
