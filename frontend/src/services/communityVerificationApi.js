import { client } from './api.js';

function unwrap(promise) {
  return promise.then((response) => response.data).catch((error) => {
    const message = error.response?.data?.error || error.message || 'Không thể xử lý xác minh cộng đồng.';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    throw wrapped;
  });
}

export function getCommunityVerificationQueue(params = {}) {
  return unwrap(client.get('/contributions/verification/queue', { params }));
}

export function submitCommunityVerification(id, verdict, reason) {
  return unwrap(client.post(
    '/contributions/' + encodeURIComponent(id) + '/verification',
    {
      verdict,
      ...(reason?.trim() ? { reason: reason.trim() } : {})
    }
  ));
}
