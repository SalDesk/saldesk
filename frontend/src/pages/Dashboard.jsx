import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, CalendarDays, Users, Zap,
  Building2, ArrowRight, Car, Utensils, Activity,
} from 'lucide-react';
import { getResumo } from '../services/financeiroService';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import KpiCard from '../components/financial/KpiCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const TODAY = new Date().toISOString().slice(0, 10);

function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}

const CELL = {
  available: { bg: 'bg-[#ECFDF5]', text: 'text-[#1A7A4A]', dot: 'bg-[#1A7A4A]', label: 'Disponivel'  },
  occupied:  { bg: 'bg-ocean-50',   text: 'text-ocean-700',  dot: 'bg-ocean-500',  label: 'Ocupado'    },
  checkin:   { bg: 'bg-[#FFFBEB]',  text: 'text-[#92400E]',  dot: 'bg-[#F59E0B]',  label: 'Check-in'   },
  checkout:  { bg: 'bg-[#FEF3C7]',  text: 'text-[#78350F]',  dot: 'bg-[#D97706]',  label: 'Check-out'  },
  inactive:  { bg: 'bg-n-50',       text: 'text-n-400',      dot: 'bg-n-300',       label: 'Inactivo'   },
};

function unitStatus(unit) {
  return unit.status === 'inactive' || unit.is_active === false ? 'inactive' : null;
}

function StatusCell({ name, status }) {
  const s = CELL[status] || CELL.available;
  return (
    <div className={`rounded-sm border border-n-100 px-2 py-2 flex flex-col gap-0.5 ${s.bg}`}>
      <span className={`text-xs font-display font-semibold truncate leading-snug ${s.text}`}>{name}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{s.label}</span>
      </div>
    </div>
  );
}

function MapLegend({ keys }) {
  return (
    <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-n-100">
      {keys.map(k => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${CELL[k].dot}`} />
          <span className="text-xs font-body text-n-500">{CELL[k].label}</span>
        </div>
      ))}
    </div>
  );
}

function HotelMap({ units, todayRes }) {
  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in')                                           { m[r.unit_id] = 'occupied'; return; }
      if (r.check_out === TODAY && !m[r.unit_id])                              { m[r.unit_id] = 'checkout'; return; }
      if (r.check_in === TODAY && r.status === 'confirmed' && !m[r.unit_id])     m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">Sem unidades registadas.</p>;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {units.map(u => (
          <StatusCell key={u.id} name={u.name} status={unitStatus(u) || statusMap[u.id] || 'available'} />
        ))}
      </div>
      <MapLegend keys={['available', 'checkin', 'occupied', 'checkout', 'inactive']} />
    </>
  );
}

function ActivityToday({ units, todayRes }) {
  const grouped = useMemo(() => {
    const m = {};
    todayRes
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => {
        if (!m[r.unit_id]) m[r.unit_id] = { count: 0, guests: 0 };
        m[r.unit_id].count++;
        m[r.unit_id].guests += r.guests || 1;
      });
    return m;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">Sem actividades registadas.</p>;

  return (
    <div className="space-y-2">
      {units.map(u => {
        const g = grouped[u.id];
        const inactive = u.status === 'inactive' || u.is_active === false;
        return (
          <div
            key={u.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-sm border ${
              inactive ? 'bg-n-50 border-n-100' : g ? 'bg-ocean-50 border-ocean-100' : 'bg-white border-n-100'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${inactive ? 'bg-n-300' : g ? 'bg-ocean-500' : 'bg-n-200'}`} />
              <span className={`text-sm font-display font-medium truncate ${inactive ? 'text-n-400' : 'text-n-900'}`}>{u.name}</span>
            </div>
            {inactive ? (
              <span className="text-[10px] font-mono uppercase tracking-wide text-n-300 shrink-0">Inactivo</span>
            ) : g ? (
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs font-display font-semibold text-ocean-700">{g.count} sess.</p>
                <p className="text-[10px] font-body text-n-400">{g.guests} part.</p>
              </div>
            ) : (
              <span className="text-[10px] font-mono uppercase tracking-wide text-n-300 shrink-0">Livre</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FleetGrid({ units, todayRes }) {
  const occupiedIds = useMemo(() => {
    const s = new Set();
    todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).forEach(r => s.add(r.unit_id));
    return s;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">Sem veiculos registados.</p>;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {units.map(u => {
          const st = unitStatus(u) || (occupiedIds.has(u.id) ? 'occupied' : 'available');
          const s = CELL[st];
          return (
            <div key={u.id} className={`rounded-sm border border-n-100 p-3 ${s.bg}`}>
              <div className="flex items-start justify-between mb-2">
                <Car size={16} strokeWidth={1.75} className={s.text} />
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              </div>
              <p className={`text-sm font-display font-semibold truncate ${s.text}`}>{u.name}</p>
              <p className={`text-[10px] font-body text-n-500 truncate mt-0.5`}>{u.unit_type}</p>
              <p className={`text-[10px] font-mono uppercase tracking-wide mt-1 ${s.text}`}>{s.label}</p>
            </div>
          );
        })}
      </div>
      <MapLegend keys={['available', 'occupied', 'inactive']} />
    </>
  );
}

function TableMap({ units, todayRes }) {
  const statusMap = useMemo(() => {
    const m = {};
    todayRes
      .filter(r => ['confirmed', 'checked_in'].includes(r.status))
      .forEach(r => { m[r.unit_id] = r.status === 'checked_in' ? 'occupied' : 'checkin'; });
    return m;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">Sem mesas registadas.</p>;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {units.map(u => (
          <StatusCell key={u.id} name={u.name} status={unitStatus(u) || statusMap[u.id] || 'available'} />
        ))}
      </div>
      <MapLegend keys={['available', 'checkin', 'occupied', 'inactive']} />
    </>
  );
}

const TYPE_LABEL = {
  hotel:      'Hotel / Alojamento',
  activity:   'Actividade Turistica',
  rentacar:   'Rent-a-Car',
  restaurant: 'Restaurante / Bar',
};

const QUICK_LINKS = [
  { icon: BookOpen,     label: 'Reservas',    desc: 'Gerir e acompanhar reservas',      to: '/reservas'   },
  { icon: CalendarDays, label: 'Calendario',  desc: 'Vista mensal de ocupacao',         to: '/calendario' },
  { icon: Users,        label: 'Clientes',    desc: 'CRM com historico e estatisticas', to: '/clientes'   },
  { icon: Zap,          label: 'Automacoes',  desc: 'Emails e WhatsApp automaticos',    to: '/automacoes' },
  { icon: BarChart2,    label: 'Financeiro',  desc: 'Relatorios e exportacoes',         to: '/financeiro' },
  { icon: Building2,    label: 'Unidades',    desc: 'Gerir quartos, actividades, etc.', to: '/unidades'   },
];

const MAP_SECTIONS = {
  hotel:      { title: 'Mapa de Quartos — Hoje', Component: HotelMap    },
  activity:   { title: 'Actividades Hoje',        Component: ActivityToday },
  rentacar:   { title: 'Frota — Estado Actual',   Component: FleetGrid   },
  restaurant: { title: 'Mapa de Mesas — Hoje',    Component: TableMap    },
};

export default function Dashboard() {
  const t = useT();
  const { operator } = useAuthStore();
  const navigate    = useNavigate();
  const opType      = operator?.operator_type;
  const periodo     = mesAtual();

  const [resumo,     setResumo]     = useState(null);
  const [units,      setUnits]      = useState([]);
  const [todayRes,   setTodayRes]   = useState([]);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    getResumo(periodo.inicio, periodo.fim).then(setResumo).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
    ])
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
    if (opType === 'activity') {
      const n = todayRes.filter(r => ['pending','confirmed','checked_in'].includes(r.status)).length;
      return { label: 'Tours hoje', value: n, icon: Activity };
    }
    if (opType === 'rentacar') {
      const n = todayRes.filter(r => ['confirmed','checked_in'].includes(r.status)).length;
      return { label: 'Alugueres activos', value: n, icon: Car };
    }
    if (opType === 'restaurant') {
      const n = todayRes.filter(r => ['pending','confirmed','checked_in'].includes(r.status)).length;
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
    if (opType === 'activity') {
      const guests = todayRes
        .filter(r => ['pending','confirmed','checked_in'].includes(r.status))
        .reduce((s, r) => s + (r.guests || 1), 0);
      return { label: 'Participantes hoje', value: guests, icon: Users };
    }
    if (opType === 'rentacar') {
      const rentedIds = new Set(
        todayRes.filter(r => ['confirmed','checked_in'].includes(r.status)).map(r => r.unit_id)
      );
      const avail = active.filter(u => !rentedIds.has(u.id)).length;
      return { label: 'Veiculos disponiveis', value: avail, icon: Car };
    }
    if (opType === 'restaurant') {
      const covers = todayRes
        .filter(r => ['confirmed','checked_in'].includes(r.status))
        .reduce((s, r) => s + (r.guests || 0), 0);
      return { label: 'Covers hoje', value: covers, icon: Users };
    }
    return { label: t('dashboard.occupancy'), value: atual?.taxa_ocupacao ?? '—', format: 'percent', icon: BarChart2, delta: v?.taxa_ocupacao };
  }, [opType, units, todayRes, atual, v, t]);

  const mapSection = opType ? MAP_SECTIONS[opType] : null;
  const MapComp    = mapSection?.Component ?? null;

  return (
    <div>
      <PageHeader
        title={`Bem-vindo, ${operator?.name || ''}`}
        subtitle={`${TYPE_LABEL[opType] || ''} · ${periodo.inicio.slice(0, 7)}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label={t('dashboard.revenue')}
          value={atual?.receita ?? '—'}
          delta={v?.receita}
          deltaLabel="vs mes ant."
          icon={Euro}
          format="euro"
        />
        <KpiCard
          label={kpi2.label}
          value={kpi2.value}
          icon={kpi2.icon}
        />
        <KpiCard
          label={kpi3.label}
          value={kpi3.value}
          delta={kpi3.delta}
          deltaLabel="p.p."
          icon={kpi3.icon}
          format={kpi3.format}
        />
      </div>

      {mapSection && (
        <div className="bg-white rounded-md border border-n-200 shadow-sm p-5 mb-8">
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide mb-4">
            {mapSection.title}
          </h2>
          {mapLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size={24} />
            </div>
          ) : (
            <MapComp units={units} todayRes={todayRes} />
          )}
        </div>
      )}

      <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide mb-3">
        {t('dashboard.quickActions')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ icon: Icon, label, desc, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="bg-white rounded-md border border-n-200 shadow-sm px-4 py-3.5 flex items-center gap-3 text-left hover:border-ocean-300 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0 group-hover:bg-ocean-100 transition-colors">
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
    </div>
  );
}
