import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* Endpoints de auth: um 401 aqui e credenciais/refresh invalidos, nao sessao
   expirada — quem chamou (ex: Login.jsx) trata o erro, sem tentar refresh
   nem forcar redireccionamento. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
function isAuthEndpoint(url) {
  return AUTH_ENDPOINTS.some((p) => url?.includes(p));
}

let refreshPromise = null;

async function refreshAccessToken() {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new Error('Sem refresh token disponivel');

  const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken });
  const { access_token, refresh_token, user, operator } = data.data;
  useAuthStore.getState().setAuth(access_token, user, operator, refresh_token);
  return access_token;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err.response?.status;

    if (status !== 401 || !originalRequest || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(err);
    }

    if (originalRequest._retry) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(err);
    }
    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(err);
    }
  }
);

export default api;
