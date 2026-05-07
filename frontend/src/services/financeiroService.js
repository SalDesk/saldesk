const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

function headers(token) {
  return { Authorization: `Bearer ${token}` };
}

function qs(params) {
  return new URLSearchParams(params).toString();
}

export async function getResumo(token, inicio, fim) {
  const res = await fetch(`${API}/financeiro/resumo?${qs({ inicio, fim })}`, { headers: headers(token) });
  return handleResponse(res);
}

export async function getReceita(token, inicio, fim, granularidade = 'week') {
  const res = await fetch(`${API}/financeiro/receita?${qs({ inicio, fim, granularidade })}`, { headers: headers(token) });
  return handleResponse(res);
}

export async function getUnidades(token, inicio, fim) {
  const res = await fetch(`${API}/financeiro/unidades?${qs({ inicio, fim })}`, { headers: headers(token) });
  return handleResponse(res);
}

export async function getTopClientes(token, inicio, fim) {
  const res = await fetch(`${API}/financeiro/clientes?${qs({ inicio, fim })}`, { headers: headers(token) });
  return handleResponse(res);
}
