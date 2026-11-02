import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, CalendarDays, Users, Zap, Building2, ArrowRight, Car, Utensils,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import useAuthStore from '../../store/authStore';
import { useT } from '../../i18n';
import KpiCard from '../../components/financial/KpiCard';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual, HotelMap, FleetGrid, TableMap } from './shared';

/* ─── Generic dashboard (hotel / rentacar / restaurant) ─────── */

const QUICK_LINKS = [
  { icon: BookOpen,     label: 'Reservas',   desc: 'Gerir e acompanhar reservas',      to: '/reservas'   },
  { icon: CalendarDays, label: 'Calendario', desc: 'Vista mensal de ocupacao',         to: '/calendario' },
  { icon: Users,        label: 'Clientes',   desc: 'CRM com historico e estatisticas', to: '/clientes'   },
  { icon: Zap,          label: 'Automacoes', desc: 'Emails e WhatsApp automaticos',    to: '/automacoes' },
  { icon: BarChart2,    label: 'Financeiro', desc: 'Relatorios e exportacoes',         to: '/financeiro' },
  { icon: Building2,    label: 'Unidades',   desc: 'Gerir quartos, actividades, etc.', to: '/unidades'   },
];

const MAP_SECTIONS = {
  hotel:      { title: 'Mapa de Quartos — Hoje', Component: HotelMap  },
  rentacar:   { title: 'Frota — Estado Actual',  Component: FleetGrid },
  restaurant: { title: 'Mapa de Mesas — Hoje',   Component: TableMap  },
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
    Promise.all([listUnits(), listReservations({ from: TODAY, to: TODAY })])
      .then(([u, r]) => { setUnits(u || []); setTodayRes(r || []); })
      .catch(() => {})
      .finally(() => setMapLoading(false));
  }, []);

  const atual = resumo?.atual;
  const v     = resumo?.variacao;

  const kpi2 = useMemo(() => {
    if (opType === 'hotel') {
      const n = todayRes.filter(r => r.check_in === TODAY && r.status === 'confirmed').length;
      return { label: 'Check-ins hoje', value: n, icon: CalendarDays };
    }
    if (opType === 'rentacar') {
      const n = todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).length;
      return { label: 'Alugueres activos', value: n, icon: Car };
    }
    if (opType === 'restaurant') {
      const n = todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length;
      return { label: 'Reservas hoje', value: n, icon: Utensils };
    }
    return { label: t('dashboard.reservations'), value: atual?.num_reservas ?? '—', icon: BookOpen };
  }, [opType, todayRes, atual, t]);

  const kpi3 = useMemo(() => {
    const active = units.filter(u => u.status !== 'inactive' && u.is_active !== false);
    if (opType === 'hotel') {
      const occupied = active.filter(u => todayRes.some(r => r.unit_id === u.id && r.status === 'checked_in')).length;
      const pct = active.length ? Math.round((occupied / active.length) * 100) : 0;
      return { label: 'Ocupacao hoje', value: pct, format: 'percent', icon: BarChart2, delta: v?.taxa_ocupacao };
    }
    if (opType === 'rentacar') {
      const rentedIds = new Set(todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).map(r => r.unit_id));
      return { label: 'Veiculos disponiveis', value: active.filter(u => !rentedIds.has(u.id)).length, icon: Car };
    }
    if (opType === 'restaurant') {
      const covers = todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).reduce((s, r) => s + (r.guests || 0), 0);
      return { label: 'Covers hoje', value: covers, icon: Users };
    }
    return { label: t('dashboard.occupancy'), value: atual?.taxa_ocupacao ?? '—', format: 'percent', icon: BarChart2, delta: v?.taxa_ocupacao };
  }, [opType, units, todayRes, atual, v, t]);

  const mapSection = opType ? MAP_SECTIONS[opType] : null;
  const MapComp    = mapSection?.Component ?? null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard label={t('dashboard.revenue')} value={atual?.receita ?? '—'} delta={v?.receita} deltaLabel="vs mes ant." icon={Euro} format="euro" />
        <KpiCard label={kpi2.label} value={kpi2.value} icon={kpi2.icon} />
        <KpiCard label={kpi3.label} value={kpi3.value} delta={kpi3.delta} deltaLabel="p.p." icon={kpi3.icon} format={kpi3.format} />
      </div>

      {mapSection && (
        <div className="bg-white rounded-lg border border-n-200 shadow-sm p-5 mb-8">
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide mb-4">{mapSection.title}</h2>
          {mapLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
          ) : (
            <MapComp units={units} todayRes={todayRes} />
          )}
        </div>
      )}

      <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide mb-3">{t('dashboard.quickActions')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ icon: Icon, label, desc, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="bg-white rounded-lg border border-n-200 shadow-sm px-4 py-3.5 flex items-center gap-3 text-left hover:border-ocean-300 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 rounded-md bg-ocean-50 flex items-center justify-center shrink-0 group-hover:bg-ocean-100 transition-colors">
              <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-n-900">{label}</p>
              <p className="text-xs font-body text-n-500 mt-0.5 truncate">{desc}</p>
            </div>
            <ArrowRight size={14} strokeWidth={1.75} className="text-n-300 shrink-0 group-hover:text-ocean-700 transition-colors" />
          </button>
        ))}
      </div>
    </>
  );
}
