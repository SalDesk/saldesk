import travelerApi from './travelerApi';

export async function login(email, password) {
  const { data } = await travelerApi.post('/traveler-auth/login', { email, password });
  return data.data;
}

export async function register(name, email, password, phone) {
  const { data } = await travelerApi.post('/traveler-auth/register', { name, email, password, phone });
  return data.data;
}

export async function getMe() {
  const { data } = await travelerApi.get('/traveler-auth/me');
  return data.data;
}

export async function logout() {
  await travelerApi.post('/traveler-auth/logout').catch(() => {});
}

export async function changePassword(password) {
  const { data } = await travelerApi.put('/traveler-auth/password', { password });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await travelerApi.post('/traveler-auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token, password) {
  const { data } = await travelerApi.post('/traveler-auth/reset-password', { token, password });
  return data;
}
