import api from './api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data;
}

export async function register(name, email, password) {
  const { data } = await api.post('/auth/register', { name, email, password });
  return data.data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function logout() {
  await api.post('/auth/logout').catch(() => {});
}

export async function changePassword(password) {
  const { data } = await api.put('/auth/password', { password });
  return data;
}

export async function createOperator(dados) {
  const { data } = await api.post('/onboarding/operator', dados);
  return data.data;
}

export async function updateOperator(dados) {
  const { data } = await api.put('/onboarding/operator', dados);
  return data.data;
}

export async function getOnboardingStatus() {
  const { data } = await api.get('/onboarding/status');
  return data.data;
}
