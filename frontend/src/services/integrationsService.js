import api from './api';

export async function getStatus() {
  const { data } = await api.get('/integrations/status');
  return data.data;
}

export async function connectChannel(channel, dados) {
  const { data } = await api.post(`/integrations/${channel}/connect`, dados);
  return data.data;
}

export async function disconnectChannel(channel) {
  const { data } = await api.delete(`/integrations/${channel}`);
  return data;
}

export async function syncManual(channel) {
  const { data } = await api.post('/integrations/sync', channel ? { channel } : {});
  return data;
}

export async function getLogs(params = {}) {
  const { data } = await api.get('/integrations/logs', { params });
  return data;
}
