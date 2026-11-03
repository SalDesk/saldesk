import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { useT } from '../i18n';
import Button from '../components/ui/Button';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import TrialStrip from '../components/dashboard/TrialStrip';
import { mesAtual } from './dashboard/shared';
import WhatsAppPendentes from '../components/messaging/WhatsAppPendentes';
import HotelDashboard from './dashboard/HotelDashboard';
import RentacarDashboard from './dashboard/RentacarDashboard';
import RestaurantDashboard from './dashboard/RestaurantDashboard';
import GenericDashboard from './dashboard/GenericDashboard';
import ActivityDashboard from './dashboard/ActivityDashboard';
import ResumoView from './dashboard/ResumoView';

/* ─── Main export ────────────────────────────────────────────── */

export default function Dashboard() {
  const t             = useT();
  const navigate      = useNavigate();
  const { operator }  = useAuthStore();
  const dashboardView = useUiStore((s) => s.dashboardView);
  const setDashboardView = useUiStore((s) => s.setDashboardView);
  const opType        = operator?.operator_type;
  const periodo       = mesAtual();

  return (
    <div>
      <DashboardHeader
        title={t('dashboard.welcome', { name: operator?.name || '' })}
        subtitle={`${opType ? t(`dashboard.typeLabel.${opType}`) : ''} · ${periodo.inicio.slice(0, 7)}`}
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
