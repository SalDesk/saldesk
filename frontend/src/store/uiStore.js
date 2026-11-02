import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* Vistas validas do Dashboard */
const DASHBOARD_VIEWS = ['hoje', 'resumo'];

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
      /* Substituicoes explicitas do estado recolhido por id de seccao da
         navegacao. undefined = usar o defaultCollapsed da seccao. */
      navCollapsed: {},
      /* Vista do Dashboard: 'hoje' | 'resumo'. Persistida. */
      dashboardView: 'hoje',
      setLang: (lang) => set({ lang }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),
      setTheme: (theme) => set({ theme }),
      startTour: () => set({ tourForceStart: true }),
      clearTourForce: () => set({ tourForceStart: false }),
      setNavSectionCollapsed: (id, collapsed) =>
        set((s) => ({ navCollapsed: { ...s.navCollapsed, [id]: collapsed } })),
      /* Ignora qualquer valor que nao seja uma vista valida */
      setDashboardView: (view) => {
        if (DASHBOARD_VIEWS.includes(view)) set({ dashboardView: view });
      },
    }),
    {
      name: 'saldesk-ui',
      partialize: (s) => ({
        lang: s.lang,
        theme: s.theme,
        navCollapsed: s.navCollapsed,
        dashboardView: s.dashboardView,
      }),
      /* Igual ao merge superficial por omissao, mas um dashboardView
         persistido invalido volta a 'hoje' */
      merge: (persisted, current) => {
        const merged = { ...current, ...persisted };
        if (!DASHBOARD_VIEWS.includes(merged.dashboardView)) merged.dashboardView = 'hoje';
        return merged;
      },
    }
  )
);

export default useUiStore;
