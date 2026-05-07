import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      operator: null,
      setAuth: (token, user, operator) => set({ token, user, operator }),
      setOperator: (operator) => set({ operator }),
      logout: () => set({ token: null, user: null, operator: null })
    }),
    {
      name: 'saldesk-auth',
      partialize: (state) => ({ token: state.token, user: state.user, operator: state.operator })
    }
  )
);

export default useAuthStore;
