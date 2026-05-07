const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listUnits(token) {
  const res = await fetch(`${API}/units`, { headers: headers(token) });
  return handleResponse(res);
}

export async function createUnit(token, dados) {
  const res = await fetch(`${API}/units`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function updateUnit(token, id, dados) {
  const res = await fetch(`${API}/units/${id}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function deleteUnit(token, id) {
  const res = await fetch(`${API}/units/${id}`, {
    method: 'DELETE', headers: headers(token)
  });
  return handleResponse(res);
}

export async function createPricingRule(token, unitId, dados) {
  const res = await fetch(`${API}/units/${unitId}/pricing-rules`, {
    method: 'POST', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function updatePricingRule(token, unitId, ruleId, dados) {
  const res = await fetch(`${API}/units/${unitId}/pricing-rules/${ruleId}`, {
    method: 'PUT', headers: headers(token), body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function deletePricingRule(token, unitId, ruleId) {
  const res = await fetch(`${API}/units/${unitId}/pricing-rules/${ruleId}`, {
    method: 'DELETE', headers: headers(token)
  });
  return handleResponse(res);
}
