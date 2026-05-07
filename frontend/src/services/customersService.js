const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listCustomers(token, filtros = {}) {
  const params = new URLSearchParams(filtros).toString();
  const res = await fetch(`${API}/customers${params ? '?' + params : ''}`, { headers: headers(token) });
  return handleResponse(res);
}

export async function getCustomer(token, id) {
  const res = await fetch(`${API}/customers/${id}`, { headers: headers(token) });
  return handleResponse(res);
}

export async function updateCustomer(token, id, dados) {
  const res = await fetch(`${API}/customers/${id}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}
