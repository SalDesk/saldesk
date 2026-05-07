import api from './api';

export async function listAutomations() {
  const { data } = await api.get('/automations');
  return data.data;
}

export async function createAutomation(dados) {
  const { data } = await api.post('/automations', dados);
  return data.data;
}

export async function updateAutomation(id, dados) {
  const { data } = await api.put(`/automations/${id}`, dados);
  return data.data;
}

export async function deleteAutomation(id) {
  await api.delete(`/automations/${id}`);
}

export async function toggleAutomation(id, active) {
  const { data } = await api.put(`/automations/${id}`, { active });
  return data.data;
}

export async function getAutomationLogs(id) {
  const { data } = await api.get(`/automations/${id}/logs`);
  return data.data;
}
