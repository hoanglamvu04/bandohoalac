import { client } from './api.js';

export async function getHaloSyncMonitor(limit = 30) {
  try {
    const response = await client.get('/admin/halo-sync', { params: { limit } });
    return response.data;
  } catch (error) {
    const wrapped = new Error(error.response?.data?.error || error.message || 'Không tải được HALO Sync Monitor.');
    wrapped.status = error.response?.status;
    throw wrapped;
  }
}
