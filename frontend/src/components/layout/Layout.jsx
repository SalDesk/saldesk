import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import MoreDrawer from './MoreDrawer';
import { ToastContainer } from '../ui/Toast';
import useUiStore from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import { getMe } from '../../services/authService';

const OPERATOR_REFRESH_MS = 60 * 1000;

export default function Layout() {
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setOperator = useAuthStore((s) => s.setOperator);

  /* O fundador pode mudar o plano/estado de um operador no painel admin
     enquanto esse operador ja tem sessao aberta no browser -- o objecto
     `operator` (plano, plan_status, trial_ends_at) so era actualizado no
     login ou quando o token de acesso expirava e era renovado, o que podia
     demorar ate 1h. O backend ja reflecte a mudanca de imediato (authMiddleware
     faz lookup a operators em cada pedido); isto so sincroniza o lado do
     browser, para as funcionalidades desbloqueadas aparecerem sem o operador
     precisar de fazer logout/login. */
  useEffect(() => {
    let cancelled = false;
    function refreshOperator() {
      getMe().then(({ operator }) => {
        if (!cancelled && operator) setOperator(operator);
      }).catch(() => {});
    }
    const interval = setInterval(refreshOperator, OPERATOR_REFRESH_MS);
    function onVisible() { if (document.visibilityState === 'visible') refreshOperator(); }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshOperator);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshOperator);
    };
  }, [setOperator]);

  return (
    <div className="flex h-screen bg-n-50 overflow-hidden">
      {/* Sidebar — so em desktop, navegacao mobile passa pela bottom nav */}
      <div
        className={[
          'hidden md:relative md:block',
          sidebarOpen ? 'md:w-64' : 'md:w-0 md:overflow-hidden',
        ].join(' ')}
      >
        <Sidebar />
      </div>

      {/* Area principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-5 pb-20 md:p-8">
          <Outlet />
        </main>
      </div>

      <BottomNav onOpenMore={() => setMoreDrawerOpen(true)} />
      <MoreDrawer open={moreDrawerOpen} onClose={() => setMoreDrawerOpen(false)} />

      <ToastContainer />
    </div>
  );
}
