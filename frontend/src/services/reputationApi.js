import { client } from './api.js';

export async function getMyReputationSummary() {
  const response = await client.get('/contributions/reputation/me');
  return response.data;
}

export async function updateAdminReputationControl(userId, payload) {
  const response = await client.put(
    '/admin/users/' + encodeURIComponent(userId) + '/reputation-control',
    payload
  );
  return response.data;
}
