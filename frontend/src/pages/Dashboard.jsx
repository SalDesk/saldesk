import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { useT } from '../i18n';
import Button from '../components/ui/Button';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import TrialStrip from '../components/dashboard/TrialStrip';
import useAgora from '../hooks/useAgora';
import { saudacao, localeDe } from './dashboard/agendaLogic';
import WhatsAppPendentes from '../components/messaging/WhatsAppPendentes';
import HotelDashboard from './dashboard/HotelDashboard';
import RentacarDashboard from './dashboard/RentacarDashboard';
import RestaurantDashboard from './dashboard/RestaurantDashboard';
import GenericDashboard from './dashboard/GenericDashboard';
import ActivityDashboard from './dashboard/ActivityDashboard';
import ResumoView from './dashboard/ResumoView';

/* "Sexta-feira, 20 de novembro · 11:42" na lingua da app */
function dataEHora(agora, lang) {
  const data = agora.toLocaleDateString(localeDe(lang), { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  return `${data.charAt(0).toUpperCase()}${data.slice(1)} · ${hora}`;
}

/* ─── Main export ────────────────────────────────────────────── */

export default function Dashboard() {
  const t             = useT();
  const navigate      = useNavigate();
  const { operator }  = useAuthStore();
  const dashboardView = useUiStore((s) => s.dashboardView);
  const setDashboardView = useUiStore((s) => s.setDashboardView);
  const opType        = operator?.operator_type;
  const lang          = useUiStore((s) => s.lang);
  const agora         = useAgora();

  return (
    <div>
      <DashboardHeader
        title={t(`dashboard.greeting.${saudacao(agora.getHours())}`, { name: operator?.name || '' })}
        subtitle={dataEHora(agora, lang)}
        view={dashboardView}
        onViewChange={setDashboardView}
        actions={(
          <>
            <Button variant="secondary" onClick={() => navigate('/calendario')}>
              {t('dashboard.activity.viewCalendar')}
            </Button>
            <Button variant="primary" onClick={() => navigate('/reservas')}>
              {t('dashboard.activity.newReservation')}
            </Button>
          </>
        )}
      />
      <TrialStrip />
      <WhatsAppPendentes />
      {dashboardView === 'resumo'
        ? <ResumoView />
        : opType === 'activity'
          ? <ActivityDashboard />
          : opType === 'hotel'
            ? <HotelDashboard />
            : opType === 'rentacar'
              ? <RentacarDashboard />
              : opType === 'restaurant'
                ? <RestaurantDashboard />
                : <GenericDashboard />
      }
    </div>
  );
}
