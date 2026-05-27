import api from './api';

export async function getCalendar(start, end) {
  const { data } = await api.get('/calendar', { params: { start, end } });
  return data.data;
}

export async function createBlockedDates(dados) {
  const { data } = await api.post('/calendar/blocked-dates', dados);
  return data.data;
}

export async function deleteBlockedDate(id) {
  await api.delete(`/calendar/blocked-dates/${id}`);
}

export async function updateReservation(id, payload) {
  const { data } = await api.put(`/reservations/${id}`, payload);
  return data.data;
}
