import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUiStore = create(
  persist(
    (set) => ({
      lang: 'pt',
      sidebarOpen: true,
      activeModal: null,
      theme: 'system', // 'light' | 'dark' | 'system'
      setLang: (lang) => set({ lang }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'saldesk-ui',
      partialize: (s) => ({ lang: s.lang, theme: s.theme }),
    }
  )
);

export default useUiStore;
