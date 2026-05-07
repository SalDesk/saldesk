const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listReservations(token, filtros = {}) {
  const params = new URLSearchParams(filtros).toString();
  const res = await fetch(`${API}/reservations${params ? '?' + params : ''}`, {
    headers: headers(token)
  });
  return handleResponse(res);
}

export async function createReservation(token, dados) {
  const res = await fetch(`${API}/reservations`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function getReservation(token, id) {
  const res = await fetch(`${API}/reservations/${id}`, { headers: headers(token) });
  return handleResponse(res);
}

export async function updateReservation(token, id, dados) {
  const res = await fetch(`${API}/reservations/${id}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function changeStatus(token, id, status) {
  const res = await fetch(`${API}/reservations/${id}/status`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify({ status })
  });
  return handleResponse(res);
}

export async function deleteReservation(token, id) {
  const res = await fetch(`${API}/reservations/${id}`, {
    method: 'DELETE', headers: headers(token)
  });
  return handleResponse(res);
}
