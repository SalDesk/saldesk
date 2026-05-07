const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function getCalendar(token, start, end) {
  const res = await fetch(`${API}/calendar?start=${start}&end=${end}`, {
    headers: headers(token)
  });
  return handleResponse(res);
}

export async function createBlockedDates(token, dados) {
  const res = await fetch(`${API}/calendar/blocked-dates`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function deleteBlockedDate(token, id) {
  const res = await fetch(`${API}/calendar/blocked-dates/${id}`, {
    method: 'DELETE', headers: headers(token)
  });
  return handleResponse(res);
}

export async function checkAvailability(slug, unitId, checkIn, checkOut) {
  const params = new URLSearchParams({ unitId, checkIn, checkOut }).toString();
  const res = await fetch(`/public/${slug}/availability?${params}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na verificação');
  return json;
}
