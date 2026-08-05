import api from './api';

export async function listPackages() {
  const { data } = await api.get('/packages');
  return data.data;
}

export async function createPackage(dados) {
  const { data } = await api.post('/packages', dados);
  return data.data;
}

export async function updatePackage(id, dados) {
  const { data } = await api.put(`/packages/${id}`, dados);
  return data.data;
}

export async function deletePackage(id) {
  await api.delete(`/packages/${id}`);
}
