import api from './api';

export async function listOccurrences() {
  const { data } = await api.get('/occurrences');
  return data.data;
}

export async function createOccurrence(dados) {
  const { data } = await api.post('/occurrences', dados);
  return data.data;
}

export async function updateOccurrence(id, dados) {
  const { data } = await api.put(`/occurrences/${id}`, dados);
  return data.data;
}

export async function deleteOccurrence(id) {
  await api.delete(`/occurrences/${id}`);
}
