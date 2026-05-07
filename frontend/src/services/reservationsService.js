import api from './api';

export async function listReservations(filtros = {}) {
  const { data } = await api.get('/reservations', { params: filtros });
  return data.data;
}

export async function getReservation(id) {
  const { data } = await api.get(`/reservations/${id}`);
  return data.data;
}

export async function createReservation(dados) {
  const { data } = await api.post('/reservations', dados);
  return data.data;
}

export async function updateReservation(id, dados) {
  const { data } = await api.put(`/reservations/${id}`, dados);
  return data.data;
}

export async function changeStatus(id, status) {
  const { data } = await api.put(`/reservations/${id}/status`, { status });
  return data.data;
}

export async function deleteReservation(id) {
  await api.delete(`/reservations/${id}`);
}
