import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import MoreDrawer from './MoreDrawer';
import { ToastContainer } from '../ui/Toast';
import useUiStore from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import { getMe } from '../../services/authService';
import { trackPageView } from '../../utils/telemetry';

const OPERATOR_REFRESH_MS = 60 * 1000;

export default function Layout() {
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setOperator = useAuthStore((s) => s.setOperator);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  /* O "online" que o fundador ve em Comunicacao (AdminCommunications.jsx)
     vem so de haver algum socket ligado com este operator_id -- e o
     unico sitio que ligava um socket era Messages.jsx, so enquanto essa
     pagina especifica estava aberta. Um operador que nunca visita
     "Mensagens" aparecia sempre offline, em qualquer outra pagina.
     Esta ligacao persiste por toda a sessao (Layout esta sempre montado),
     so para presenca -- Messages.jsx continua com a sua propria ligacao
     para os seus proprios eventos, as duas coexistem sem problema (o
     backend so marca offline quando TODOS os sockets do operador
     desligam). */
  useEffect(() => {
    if (!token) return;
    const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace(/\/api\/v1\/?$/, '');
    const socket = io(socketUrl, { auth: { token } });
    return () => socket.disconnect();
  }, [token]);

  /* Alimenta a aba "Trafego" da Analytics do fundador (getAnalyticsTraffic
     em adminController.js) -- dispara a cada mudanca de rota dentro da app. */
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

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
