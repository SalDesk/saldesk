import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* Store completamente separada de authStore.js (operadores) -- chave de
   localStorage propria para que uma sessao de operador e uma de viajante
   possam coexistir no mesmo browser sem se sobreporem. */
const REMEMBER_KEY = 'saldesk-traveler-remember-device';

function isRemembered() {
  try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; }
}

export function setTravelerRememberDevice(remember) {
  try { localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'); } catch { /* ignore */ }
}

const rememberAwareStorage = {
  getItem: (name) => {
    try { return localStorage.getItem(name) ?? sessionStorage.getItem(name); }
    catch { return null; }
  },
  setItem: (name, value) => {
    try {
      if (isRemembered()) {
        localStorage.setItem(name, value);
        sessionStorage.removeItem(name);
      } else {
        sessionStorage.setItem(name, value);
        localStorage.removeItem(name);
      }
    } catch { /* ignore */ }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); sessionStorage.removeItem(name); } catch { /* ignore */ }
  },
};

const useTravelerAuthStore = create(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      traveler: null,
      setAuth: (token, user, traveler, refreshToken) => set({ token, user, traveler, refreshToken: refreshToken ?? null }),
      setTraveler: (traveler) => set({ traveler }),
      setToken: (token, refreshToken) => set({ token, refreshToken: refreshToken ?? null }),
      logout: () => { setTravelerRememberDevice(true); set({ token: null, refreshToken: null, user: null, traveler: null }); },
    }),
    {
      name: 'saldesk-traveler-auth',
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, user: state.user, traveler: state.traveler })
    }
  )
);

export default useTravelerAuthStore;
