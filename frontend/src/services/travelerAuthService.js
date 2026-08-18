import travelerApi from './travelerApi';
import supabaseAuthClient from '../lib/supabaseAuthClient';

export async function login(email, password) {
  const { data } = await travelerApi.post('/traveler-auth/login', { email, password });
  return data.data;
}

/* Inicia o redireccionamento OAuth -- a pagina navega para fora e so volta
   em /viajante/oauth-callback, tratado por TravelerOAuthCallback.jsx. */
export async function signInWithProvider(provider) {
  const { error } = await supabaseAuthClient.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/viajante/oauth-callback` },
  });
  if (error) throw error;
}

/* Chamado depois do redireccionamento OAuth voltar, quando o supabase-js ja
   tem uma sessao valida (access_token do Google/Apple). Troca-a por uma
   conta de viajante real (criada agora, se for a primeira vez). */
export async function completeOAuthLogin(accessToken, refreshToken) {
  const { data } = await travelerApi.post('/traveler-auth/oauth-complete', { access_token: accessToken, refresh_token: refreshToken });
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
