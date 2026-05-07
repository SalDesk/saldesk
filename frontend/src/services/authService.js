const API = '/api';

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na requisição');
  return json;
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
}

export async function register(email, password, name) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  return handleResponse(res);
}

export async function getMe(token) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res);
}

export async function createOperator(token, dados) {
  const res = await fetch(`${API}/onboarding/operator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados)
  });
  return handleResponse(res);
}

export async function getOnboardingStatus(token) {
  const res = await fetch(`${API}/onboarding/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res);
}
