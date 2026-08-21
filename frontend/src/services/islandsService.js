import api from './api';

export async function listIslands() {
  const { data } = await api.get('/public/islands');
  return data.data;
}
