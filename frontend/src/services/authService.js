import api from './api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data;
}

export async function register(name, email, password, inviteCode) {
  const { data } = await api.post('/auth/register', { name, email, password, invite_code: inviteCode });
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

export async function validateInvite(code) {
  const { data } = await api.post('/auth/validate-invite', { code });
  return data.data; // { valid: boolean }
}

export async function forgotPassword(email) {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token, password) {
  const { data } = await api.post('/auth/reset-password', { token, password });
  return data;
}

export async function sendTwoFactor(email) {
  const { data } = await api.post('/auth/2fa/send', { email });
  return data;
}

export async function verifyTwoFactor(email, code) {
  const { data } = await api.post('/auth/2fa/verify', { email, code });
  return data.data;
}

export async function toggleTwoFactor(enabled) {
  const { data } = await api.put('/auth/2fa/toggle', { enabled });
  return data.data;
}

export async function getLoginHistory() {
  try {
    const { data } = await api.get('/auth/sessions');
    return data.data || [];
  } catch { return []; }
}

export async function terminateSession(sessionId) {
  await api.delete(`/auth/sessions/${sessionId}`).catch(() => {});
}

export async function terminateAllSessions() {
  await api.delete('/auth/sessions').catch(() => {});
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
