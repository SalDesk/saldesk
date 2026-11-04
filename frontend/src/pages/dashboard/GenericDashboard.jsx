import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, CalendarDays, Users, Zap, Building2, ArrowRight, Car, Utensils, LayoutGrid,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { estadiaEm } from '../../services/reservationRanges';
import useAuthStore from '../../store/authStore';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, uniaoPorId, HotelMap, FleetGrid, TableMap } from './shared';

/* ─── Generic dashboard (hotel / rentacar / restaurant) ─────── */

/* Atalhos que a casca nao tem (Ver calendario e Nova reserva ja estao no cabecalho) */
const QUICK_LINKS = [
  { icon: Users,     labelKey: 'nav.customers',   descKey: 'dashboard.generic.customersDesc',   to: '/clientes'   },
  { icon: Zap,       labelKey: 'nav.automations', descKey: 'dashboard.generic.automationsDesc', to: '/automacoes' },
  { icon: BarChart2, labelKey: 'nav.financial',   descKey: 'dashboard.generic.financialDesc',   to: '/financeiro' },
  { icon: Building2, labelKey: 'nav.units',       descKey: 'dashboard.generic.unitsDesc',       to: '/unidades'   },
];

/* Mapa por tipo: titulo, componente e mensagem de vazio (todos via i18n) */
const MAP_SECTIONS = {
  hotel:      { titleKey: 'dashboard.hotel.roomMap',        emptyKey: 'dashboard.hotel.noRoomsRegistered',           Component: HotelMap  },
  rentacar:   { titleKey: 'dashboard.rentacar.fleetStatus', emptyKey: 'dashboard.rentacar.noVehiclesRegistered',     Component: FleetGrid },
  restaurant: { titleKey: 'dashboard.restaurant.tableMap',  emptyKey: 'dashboard.restaurant.noTablesRegistered',     Component: TableMap  },
};

export default function GenericDashboard() {
  const t = useT();
  const { operator } = useAuthStore();
  const navigate     = useNavigate();
  const opType       = operator?.operator_type;
  const periodo      = mesAtual();

  const [resumo,     setResumo]     = useState(null);
  const [units,      setUnits]      = useState([]);
  const [todayRes,   setTodayRes]   = useState([]);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    getResumo(periodo.inicio, periodo.fim).then(setResumo).catch(() => {});
  }, []);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras */
    /* So hotel e rent-a-car: quem ja fez check-in e passou a data de saida nao sobrepoe hoje,
       mas continua a ocupar o quarto ou a viatura */
    const incluiCheckedIn = opType === 'hotel' || opType === 'rentacar';
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      incluiCheckedIn ? listReservations({ status: 'checked_in' }).catch(() => []) : Promise.resolve([]),
    ])
      .then(([u, r, ciRes]) => { setUnits(u || []); setTodayRes(uniaoPorId(r, ciRes)); })
      .catch(() => {})
      .finally(() => setMapLoading(false));
  }, []);

  const atual = resumo?.atual;
  const v     = resumo?.variacao;

  const kpi2 = useMemo(() => {
    if (opType === 'hotel') {
      const n = todayRes.filter(r => r.check_in === TODAY && r.status === 'confirmed').length;
      return { label: t('dashboard.hotel.checkinsToday'), value: n, icon: CalendarDays };
    }
    if (opType === 'rentacar') {
      const n = todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).length;
      return { label: t('dashboard.rentacar.activeRentals'), value: n, icon: Car };
    }
    if (opType === 'restaurant') {
      const n = todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length;
      return { label: t('dashboard.restaurant.reservationsToday'), value: n, icon: Utensils };
    }
    /* Formato numero: o traco como texto e aceite quando ainda nao ha dados */
    return { label: t('dashboard.reservations'), value: atual?.num_reservas ?? '—', icon: BookOpen };
  }, [opType, todayRes, atual, t]);

  const kpi3 = useMemo(() => {
    const active = units.filter(u => u.status !== 'inactive' && u.is_active !== false);
    if (opType === 'hotel') {
      const occupied = active.filter(u => todayRes.some(r => r.unit_id === u.id && r.status === 'checked_in')).length;
      const pct = active.length ? Math.round((occupied / active.length) * 100) : 0;
      return { label: t('dashboard.hotel.occupancyToday'), value: pct, format: 'percent', icon: BarChart2, delta: v?.taxa_ocupacao };
    }
    if (opType === 'rentacar') {
      const rentedIds = new Set(todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).map(r => r.unit_id));
      return { label: t('dashboard.rentacar.availableVehicles'), value: active.filter(u => !rentedIds.has(u.id)).length, icon: Car };
    }
    if (opType === 'restaurant') {
      const covers = todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).reduce((s, r) => s + (r.guests || 0), 0);
      return { label: t('dashboard.generic.coversToday'), value: covers, icon: Users };
    }
    return { label: t('dashboard.occupancy'), value: atual?.taxa_ocupacao ?? null, format: 'percent', icon: BarChart2, delta: v?.taxa_ocupacao };
  }, [opType, units, todayRes, atual, v, t]);

  /* Variacao da receita em euros (atual - anterior); sem mes anterior nao ha variacao.
     variacao.receita do backend e uma percentagem, por isso nao serve aqui */
  const receitaDelta = resumo?.atual && resumo?.anterior
    ? Number(resumo.atual.receita || 0) - Number(resumo.anterior.receita || 0)
    : undefined;

  const mapSection = opType ? MAP_SECTIONS[opType] : null;
  const MapComp    = mapSection?.Component ?? null;

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label={t('dashboard.revenue')} value={atual?.receita ?? null} delta={receitaDelta} deltaLabel={t('dashboard.vsLastMonth')} icon={Euro} format="euro" />
        <KpiCard label={kpi2.label} value={kpi2.value} icon={kpi2.icon} />
        <KpiCard label={kpi3.label} value={kpi3.value} delta={kpi3.delta} icon={kpi3.icon} format={kpi3.format} />
      </div>

      {/* Mapa do tipo de operador */}
      {mapSection && (
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <LayoutGrid size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
            <h2 className="font-display font-semibold text-sm text-n-900">{t(mapSection.titleKey)}</h2>
          </header>
          {mapLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
          ) : units.length === 0 ? (
            <EmptyState icon={LayoutGrid} title={t(mapSection.emptyKey)} />
          ) : (
            <div className="p-4">
              <MapComp units={units} todayRes={todayRes} />
            </div>
          )}
        </section>
      )}

      {/* Atalhos */}
      <section>
        <h2 className="font-display font-semibold text-sm text-n-900 mb-3">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ icon: Icon, labelKey, descKey, to }) => (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="bg-white rounded-sm border border-n-200 px-4 py-3 flex items-center gap-3 text-left hover:border-ocean-300 transition-colors group"
            >
              <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0 group-hover:bg-ocean-100 transition-colors">
                <Icon size={18} strokeWidth={1.75} className="text-ocean-700" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-n-900">{t(labelKey)}</p>
                <p className="text-xs font-body text-n-500 mt-0.5 truncate">{t(descKey)}</p>
              </div>
              <ArrowRight size={14} strokeWidth={1.75} className="text-n-300 shrink-0 group-hover:text-ocean-700 transition-colors" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
