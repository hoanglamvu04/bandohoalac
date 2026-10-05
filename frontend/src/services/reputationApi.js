import { client } from './api.js';

export async function getMyReputationSummary() {
  const response = await client.get('/contributions/reputation/me');
  return response.data;
}
