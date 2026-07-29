import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const REMEMBER_KEY = 'saldesk-remember-device';

/* "Lembrar este dispositivo": quando activo a sessao fica em localStorage
   (sobrevive a fechar o browser); quando desactivo fica so em sessionStorage
   (limpa ao fechar o separador/browser). A escolha e feita ANTES do login
   (ver setRememberDevice), por isso o storage do persist so precisa de saber,
   a cada leitura/escrita, qual dos dois usar nesse momento. */
function isRemembered() {
  try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; }
}

export function setRememberDevice(remember) {
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

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      operator: null,
      setAuth: (token, user, operator, refreshToken) => set({ token, user, operator, refreshToken: refreshToken ?? null }),
      setOperator: (operator) => set({ operator }),
      setToken: (token, refreshToken) => set({ token, refreshToken: refreshToken ?? null }),
      logout: () => { setRememberDevice(true); set({ token: null, refreshToken: null, user: null, operator: null }); },
    }),
    {
      name: 'saldesk-auth',
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, user: state.user, operator: state.operator })
    }
  )
);

export default useAuthStore;
