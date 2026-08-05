import api from './api';

export async function listGroups() {
  const { data } = await api.get('/groups');
  return data.data;
}

export async function createGroup(dados) {
  const { data } = await api.post('/groups', dados);
  return data.data;
}

export async function updateGroup(id, dados) {
  const { data } = await api.put(`/groups/${id}`, dados);
  return data.data;
}

export async function deleteGroup(id) {
  await api.delete(`/groups/${id}`);
}

export async function createGroupPayment(groupId, dados) {
  const { data } = await api.post(`/groups/${groupId}/payments`, dados);
  return data.data;
}
