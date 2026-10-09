import { client } from './api.js';

function unwrap(promise) {
  return promise.then((res) => res.data).catch((error) => {
    const message = error.response?.data?.error || error.message || 'Đã có lỗi xảy ra.';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.details = error.response?.data?.details;
    throw wrapped;
  });
}

export function getAdminIntegrations() {
  return unwrap(client.get('/admin/integrations'));
}

export function testAdminIntegration(provider, secret) {
  return unwrap(client.post(
    '/admin/integrations/' + encodeURIComponent(provider) + '/test',
    secret ? { secret } : {}
  ));
}

export function saveAdminIntegration(provider, secret) {
  return unwrap(client.put(
    '/admin/integrations/' + encodeURIComponent(provider),
    { secret }
  ));
}

export function deleteAdminIntegration(provider) {
  return unwrap(client.delete('/admin/integrations/' + encodeURIComponent(provider)));
}
