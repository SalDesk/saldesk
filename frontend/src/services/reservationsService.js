import api from './api';

/**
 * Lista reservas (GET /reservations). Os filtros passam tal como vierem.
 * Parametros que o backend entende:
 *  - status         estado da reserva
 *  - unit_id        unidade
 *  - seller_id      vendedor
 *  - check_in_from, check_in_to   intervalo pela data de check-in
 *  - stay_from, stay_to           estadia que sobrepoe o intervalo (inclusivo);
 *                                 usar os helpers de ./reservationRanges
 * ATENCAO: os parametros `from` e `to` NAO existem no backend; nao os usar.
 */
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
