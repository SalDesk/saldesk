import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUiStore = create(
  persist(
    (set) => ({
      lang: 'pt',
      sidebarOpen: true,
      activeModal: null,
      setLang: (lang) => set({ lang }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'saldesk-ui',
      partialize: (s) => ({ lang: s.lang }),
    }
  )
);

export default useUiStore;
