import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUiStore = create(
  persist(
    (set) => ({
      lang: 'pt',
      sidebarOpen: true,
      activeModal: null,
      theme: 'system', // 'light' | 'dark' | 'system'
      /* Nunca persistido -- so um sinal efemero para o WelcomeTour recomecar
         a pedido (botao "Rever tour" em Definicoes), independente do
         operators.tour_completed_at real. */
      tourForceStart: false,
      setLang: (lang) => set({ lang }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),
      setTheme: (theme) => set({ theme }),
      startTour: () => set({ tourForceStart: true }),
      clearTourForce: () => set({ tourForceStart: false }),
    }),
    {
      name: 'saldesk-ui',
      partialize: (s) => ({ lang: s.lang, theme: s.theme }),
    }
  )
);

export default useUiStore;
