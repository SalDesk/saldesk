import api from './api';

export async function listPartners() {
  const { data } = await api.get('/partners');
  return data.data;
}

export async function createPartner(dados) {
  const { data } = await api.post('/partners', dados);
  return data.data;
}

export async function updatePartner(id, dados) {
  const { data } = await api.put(`/partners/${id}`, dados);
  return data.data;
}

export async function deletePartner(id) {
  await api.delete(`/partners/${id}`);
}

export async function registerPartnerBooking(id, direction, delta) {
  const { data } = await api.post(`/partners/${id}/bookings`, { direction, delta });
  return data.data;
}

export async function searchOperators(q) {
  const { data } = await api.get(`/partners/search-operators?q=${encodeURIComponent(q)}`);
  return data.data;
}

export async function requestPartnership(dados) {
  const { data } = await api.post('/partners/request', dados);
  return data.data;
}

export async function respondPartnership(id, status) {
  const { data } = await api.put(`/partners/${id}/respond`, { status });
  return data.data;
}
