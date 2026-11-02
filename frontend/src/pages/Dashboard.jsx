import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import { mesAtual } from './dashboard/shared';
import WhatsAppPendentes from '../components/messaging/WhatsAppPendentes';
import HotelDashboard from './dashboard/HotelDashboard';
import RentacarDashboard from './dashboard/RentacarDashboard';
import RestaurantDashboard from './dashboard/RestaurantDashboard';
import GenericDashboard from './dashboard/GenericDashboard';
import ActivityDashboard from './dashboard/ActivityDashboard';
import TrialBanner from './dashboard/TrialBanner';

/* ─── Main export ────────────────────────────────────────────── */

export default function Dashboard() {
  const t             = useT();
  const { operator }  = useAuthStore();
  const opType        = operator?.operator_type;
  const periodo       = mesAtual();

  return (
    <div>
      <PageHeader
        title={t('dashboard.welcome', { name: operator?.name || '' })}
        subtitle={`${opType ? t(`dashboard.typeLabel.${opType}`) : ''} · ${periodo.inicio.slice(0, 7)}`}
      />
      <TrialBanner />
      <WhatsAppPendentes />
      {opType === 'activity'
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
