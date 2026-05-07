const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listAutomations(token) {
  const res = await fetch(`${API}/automations`, { headers: headers(token) });
  return handleResponse(res);
}

export async function createAutomation(token, dados) {
  const res = await fetch(`${API}/automations`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function updateAutomation(token, id, dados) {
  const res = await fetch(`${API}/automations/${id}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function deleteAutomation(token, id) {
  const res = await fetch(`${API}/automations/${id}`, {
    method: 'DELETE', headers: headers(token)
  });
  return handleResponse(res);
}

export async function getAutomationLogs(token, id) {
  const res = await fetch(`${API}/automations/${id}/logs`, { headers: headers(token) });
  return handleResponse(res);
}
