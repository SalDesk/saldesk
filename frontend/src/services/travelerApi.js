import axios from 'axios';
import useTravelerAuthStore from '../store/travelerAuthStore';

const travelerApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  timeout: 15_000,
  /* Necessario para o backend conseguir definir/ler a cookie de sessao
     partilhada (.saldesk.cv, ver travelerSessionCookie.js) -- sem isto o
     browser ignora qualquer Set-Cookie devolvido por um pedido cross-origin. */
  withCredentials: true,
});

travelerApi.interceptors.request.use((config) => {
  const token = useTravelerAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_ENDPOINTS = ['/traveler-auth/login', '/traveler-auth/register', '/traveler-auth/oauth-complete', '/traveler-auth/refresh', '/traveler-auth/forgot-password', '/traveler-auth/reset-password'];
function isAuthEndpoint(url) {
  return AUTH_ENDPOINTS.some((p) => url?.includes(p));
}

let refreshPromise = null;

async function refreshAccessToken() {
  const { refreshToken } = useTravelerAuthStore.getState();
  if (!refreshToken) throw new Error('Sem refresh token disponivel');

  const { data } = await axios.post(`${travelerApi.defaults.baseURL}/traveler-auth/refresh`, { refresh_token: refreshToken }, { withCredentials: true });
  const { access_token, refresh_token, user, traveler } = data.data;
  useTravelerAuthStore.getState().setAuth(access_token, user, traveler, refresh_token);
  return access_token;
}

travelerApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err.response?.status;

    if (status !== 401 || !originalRequest || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(err);
    }

    if (originalRequest._retry) {
      useTravelerAuthStore.getState().logout();
      window.location.href = '/viajante/entrar';
      return Promise.reject(err);
    }
    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return travelerApi(originalRequest);
    } catch {
      useTravelerAuthStore.getState().logout();
      window.location.href = '/viajante/entrar';
      return Promise.reject(err);
    }
  }
);

export default travelerApi;
