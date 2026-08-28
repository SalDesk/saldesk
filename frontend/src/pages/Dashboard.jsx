import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, CalendarDays, Users, Zap,
  Building2, ArrowRight, Car, Utensils, UtensilsCrossed,
  Compass, Star, AlertTriangle, Clock, TrendingUp, CheckCircle,
  CloudRain, X as XIcon,
  Wrench, MoveRight, MoveLeft, BedDouble, Sparkles,
} from 'lucide-react';
import usePlan from '../hooks/usePlan';
import { getResumo } from '../services/financeiroService';
import { listUnits } from '../services/unitsService';
import { listReservations } from '../services/reservationsService';
import { getWeatherForecast, weatherInfo, isBadWeather } from '../services/weatherService';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import useUiStore from '../store/uiStore';
import PageHeader from '../components/layout/PageHeader';
import KpiCard from '../components/financial/KpiCard';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* Data local do dispositivo, nao UTC -- ver nota em BeachSeller.jsx */
const TODAY = new Date().toLocaleDateString('en-CA');

function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}

/* ─── Shared helpers ─────────────────────────────────────────── */

const CELL = {
  available:   { bg: 'bg-[#ECFDF5]', text: 'text-[#1A7A4A]',  dot: 'bg-[#1A7A4A]' },
  occupied:    { bg: 'bg-ocean-50',  text: 'text-ocean-700',   dot: 'bg-ocean-500' },
  checkin:     { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]',   dot: 'bg-[#F59E0B]' },
  checkout:    { bg: 'bg-[#FEF3C7]', text: 'text-[#78350F]',   dot: 'bg-[#D97706]' },
  cleaning:    { bg: 'bg-orange-50', text: 'text-orange-700',  dot: 'bg-orange-400' },
  maintenance: { bg: 'bg-[#FEF2F2]', text: 'text-error',       dot: 'bg-error' },
  breakdown:   { bg: 'bg-red-100',   text: 'text-red-700',     dot: 'bg-red-600' },
  inactive:    { bg: 'bg-n-50',      text: 'text-n-400',       dot: 'bg-n-300' },
};

function unitStatus(unit) {
  if (unit.status === 'breakdown')   return 'breakdown';
  if (unit.status === 'maintenance') return 'maintenance';
  if (unit.status === 'cleaning')    return 'cleaning';
  if (unit.status === 'inactive' || unit.is_active === false) return 'inactive';
  return null;
}

function parseVehicleMeta(unit) {
  try { return JSON.parse(unit?.description || '{}'); } catch { return {}; }
}

function StatusCell({ name, status }) {
  const t = useT();
  const s = CELL[status] || CELL.available;
  return (
    <div className={`rounded-sm border border-n-100 px-2 py-2 flex flex-col gap-0.5 ${s.bg}`}>
      <span className={`text-xs font-display font-semibold truncate leading-snug ${s.text}`}>{name}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${status}`)}</span>
      </div>
    </div>
  );
}

function MapLegend({ keys }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-n-100">
      {keys.map(k => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${CELL[k].dot}`} />
          <span className="text-xs font-body text-n-500">{t(`dashboard.map.${k}`)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Type-specific map components ──────────────────────────── */

function HotelMap({ units, todayRes, onSelect }) {
  const t = useT();
  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in')                                               { m[r.unit_id] = 'occupied'; return; }
      if (r.check_out === TODAY && !m[r.unit_id])                                  { m[r.unit_id] = 'checkout'; return; }
      if (r.check_in === TODAY && r.status === 'confirmed' && !m[r.unit_id])         m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.hotel.noRoomsRegistered')}</p>;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {units.map(u => {
          const st = unitStatus(u) || statusMap[u.id] || 'available';
          if (onSelect) {
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelect(u)}
                className="text-left w-full hover:ring-2 hover:ring-ocean-300 rounded-sm transition-all"
              >
                <StatusCell name={u.name} status={st} />
              </button>
            );
          }
          return <StatusCell key={u.id} name={u.name} status={st} />;
        })}
      </div>
      <MapLegend keys={['available', 'checkin', 'occupied', 'checkout', 'cleaning', 'maintenance', 'inactive']} />
    </>
  );
}

function FleetGrid({ units, todayRes }) {
  const t = useT();
  const occupiedIds = useMemo(() => {
    const s = new Set();
    todayRes.filter(r => ['confirmed', 'checked_in'].includes(r.status)).forEach(r => s.add(r.unit_id));
    return s;
  }, [todayRes]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.rentacar.noVehiclesRegistered')}</p>;
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
              <p className="text-[10px] font-body text-n-500 truncate mt-0.5">{u.unit_type}</p>
              <p className={`text-[10px] font-mono uppercase tracking-wide mt-1 ${s.text}`}>{t(`dashboard.map.${st}`)}</p>
            </div>
          );
        })}
      </div>
      <MapLegend keys={['available', 'occupied', 'inactive']} />
    </>
  );
}

function TableCell({ unit, status }) {
  const t    = useT();
  const s    = CELL[status] || CELL.available;
  const meta = parseVehicleMeta(unit);
  const num  = meta.number ? `M${meta.number}` : unit.name;
  const cap  = meta.capacity_max || unit.capacity || '';
  return (
    <div className={`rounded-sm border border-n-100 px-2 py-2.5 flex flex-col gap-0.5 ${s.bg}`}>
      <span className={`text-sm font-display font-bold leading-snug ${s.text}`}>{num}</span>
      {cap ? <span className="text-[10px] font-body text-n-400">{cap} {t('dashboard.common.pax')}</span> : null}
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${status}`)}</span>
      </div>
    </div>
  );
}

const ZONE_KEYS  = { interior: 'interior', esplanada: 'esplanada', terraco: 'terraco', vip: 'vip', privado: 'privado' };
const ZONE_ORDER = ['interior', 'esplanada', 'terraco', 'vip', 'privado'];

function TableMap({ units, todayRes, onSelect }) {
  const t = useT();
  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in' && !m[r.unit_id])               { m[r.unit_id] = 'occupied'; return; }
      if (['pending', 'confirmed'].includes(r.status) && !m[r.unit_id]) m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  const zones = useMemo(() => {
    const map = {};
    units.forEach(u => {
      const zone = parseVehicleMeta(u).zone || 'interior';
      if (!map[zone]) map[zone] = [];
      map[zone].push(u);
    });
    return map;
  }, [units]);

  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.restaurant.noTablesRegistered')}</p>;

  const zoneKeys = ZONE_ORDER.filter(z => zones[z]).concat(Object.keys(zones).filter(z => !ZONE_ORDER.includes(z)));

  return (
    <>
      {zoneKeys.map(zone => (
        <div key={zone} className="mb-5 last:mb-0">
          <p className="text-[10px] font-mono font-semibold text-n-500 uppercase tracking-widest mb-2">
            {ZONE_KEYS[zone] ? t(`dashboard.zones.${zone}`) : zone}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {zones[zone].map(u => {
              const st = unitStatus(u) || statusMap[u.id] || 'available';
              if (onSelect) {
                return (
                  <button key={u.id} type="button" onClick={() => onSelect(u)}
                    className="text-left w-full hover:ring-2 hover:ring-ocean-300 rounded-sm transition-all">
                    <TableCell unit={u} status={st} />
                  </button>
                );
              }
              return <TableCell key={u.id} unit={u} status={st} />;
            })}
          </div>
        </div>
      ))}
      <MapLegend keys={['available', 'checkin', 'occupied', 'inactive']} />
    </>
  );
}

/* ─── Hotel dashboard ───────────────────────────────────────── */

const STATUS_BADGE_MAP_H = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'info', checked_out: 'default', cancelled: 'cancelled',
};
const STATUS_KEY_H = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'active', checked_out: 'completed', cancelled: 'cancelled',
};

function HotelDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const periodo  = mesAtual();

  const [units,    setUnits]    = useState([]);
  const [todayRes, setTodayRes] = useState([]);
  const [monthRes, setMonthRes] = useState([]);
  const [resumo,   setResumo]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
      listReservations({ from: periodo.inicio, to: periodo.fim }),
      getResumo(periodo.inicio, periodo.fim),
    ])
      .then(([u, tRes, mRes, res]) => {
        setUnits(u || []);
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setResumo(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const active   = units.filter(u => !['inactive', 'maintenance'].includes(u.status) && u.is_active !== false);
    const occupied = active.filter(u => todayRes.some(r => r.unit_id === u.id && r.status === 'checked_in')).length;
    const pct      = active.length ? Math.round((occupied / active.length) * 100) : 0;
    return {
      ocupacao:  pct,
      receita:   resumo?.atual?.receita ?? 0,
      checkins:  todayRes.filter(r => r.check_in  === TODAY && ['pending', 'confirmed'].includes(r.status)).length,
      checkouts: todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in').length,
      pendentes: monthRes.filter(r => r.status === 'pending').length,
    };
  }, [units, todayRes, monthRes, resumo]);

  const checkinsHoje  = useMemo(() =>
    todayRes.filter(r => r.check_in === TODAY && ['pending', 'confirmed'].includes(r.status)),
    [todayRes]
  );
  const checkoutsHoje = useMemo(() =>
    todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in'),
    [todayRes]
  );

  const alertas = useMemo(() => ({
    manutencao:      units.filter(u => u.status === 'maintenance'),
    semConfirmacao:  todayRes.filter(r => r.check_in === TODAY && r.status === 'pending'),
    limpeza:         units.filter(u => u.status === 'cleaning').length,
  }), [units, todayRes]);

  const roomRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['checked_in', 'confirmed', 'pending'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-6">

      {/* Alertas */}
      {(alertas.manutencao.length > 0 || alertas.semConfirmacao.length > 0 || alertas.limpeza > 0) && (
        <div className="space-y-2">
          {alertas.manutencao.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md">
              <Wrench size={15} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
              <p className="text-sm font-body text-error flex-1">
                <span className="font-semibold">{t('dashboard.hotel.maintenanceAlert', { n: alertas.manutencao.length })}</span>{' '}
                {alertas.manutencao.map(u => u.name).join(', ')}
              </p>
            </div>
          )}
          {alertas.semConfirmacao.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md">
              <AlertTriangle size={15} strokeWidth={1.75} className="text-[#B45309] shrink-0" />
              <p className="text-sm font-body text-[#B45309] flex-1">
                <span className="font-semibold">{t('dashboard.hotel.noConfirmationAlert', { n: alertas.semConfirmacao.length })}</span>
              </p>
              <button
                onClick={() => navigate('/reservas')}
                className="text-xs font-semibold text-[#B45309] underline whitespace-nowrap shrink-0"
              >
                {t('dashboard.common.viewReservations')}
              </button>
            </div>
          )}
          {alertas.limpeza > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-md">
              <Sparkles size={15} strokeWidth={1.75} className="text-orange-600 shrink-0" />
              <p className="text-sm font-body text-orange-700 flex-1">
                <span className="font-semibold">{t('dashboard.hotel.cleaningAlert', { n: alertas.limpeza })}</span>
              </p>
              <button
                onClick={() => navigate('/housekeeping')}
                className="text-xs font-semibold text-orange-700 underline whitespace-nowrap shrink-0"
              >
                {t('dashboard.hotel.housekeeping')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label={t('dashboard.hotel.occupancyToday')}      value={kpis.ocupacao}  format="percent" icon={BarChart2}  />
        <KpiCard label={t('dashboard.hotel.revenueMonth')}        value={kpis.receita}   format="euro"    icon={Euro}       />
        <KpiCard label={t('dashboard.hotel.checkinsToday')}       value={kpis.checkins}  icon={MoveRight}                   />
        <KpiCard label={t('dashboard.hotel.checkoutsToday')}      value={kpis.checkouts} icon={MoveLeft}                    />
        <KpiCard label={t('dashboard.hotel.pendingReservations')} value={kpis.pendentes} icon={Clock}                       />
      </div>

      {/* Mapa de quartos */}
      <div className="bg-white rounded-lg border border-n-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BedDouble size={15} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide">
            {t('dashboard.hotel.roomMap')}
          </h2>
          <button
            onClick={() => navigate('/housekeeping')}
            className="ml-auto text-xs font-body text-ocean-700 hover:underline flex items-center gap-1"
          >
            <Sparkles size={11} strokeWidth={1.75} />
            {t('dashboard.hotel.housekeeping')}
          </button>
        </div>
        <HotelMap units={units} todayRes={todayRes} onSelect={setSelected} />
      </div>

      {/* Check-ins + Check-outs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <MoveRight size={14} strokeWidth={1.75} className="text-[#1A7A4A]" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.hotel.checkinsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-400">{checkinsHoje.length}</span>
          </div>
          {checkinsHoje.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-body text-n-400">{t('dashboard.hotel.noCheckinToday')}</p>
          ) : (
            <div className="divide-y divide-n-100">
              {checkinsHoje.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-400">
                      {units.find(u => u.id === r.unit_id)?.name || '—'} · {r.guests || 1} {t('dashboard.common.guestsSuffix')}
                    </p>
                  </div>
                  <Badge variant={r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                    {r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <MoveLeft size={14} strokeWidth={1.75} className="text-n-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.hotel.checkoutsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-400">{checkoutsHoje.length}</span>
          </div>
          {checkoutsHoje.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-body text-n-400">{t('dashboard.hotel.noCheckoutToday')}</p>
          ) : (
            <div className="divide-y divide-n-100">
              {checkoutsHoje.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                    <p className="text-xs font-body text-n-400">
                      {units.find(u => u.id === r.unit_id)?.name || '—'} · {r.guests || 1} {t('dashboard.common.guestsSuffix')}
                    </p>
                  </div>
                  <Badge variant="info">{t('dashboard.map.checkout')}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Room detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-xl border border-n-200 shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-base text-n-900">{selected.name}</h3>
                <p className="text-xs font-body text-n-500 mt-0.5">
                  {selected.unit_type || '—'}
                  {(() => { try { const m = JSON.parse(selected.description || '{}'); return m.floor ? ` · ${t('dashboard.hotel.floor', { n: m.floor })}` : ''; } catch { return ''; } })()}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 text-n-400 hover:text-n-700 rounded">
                <XIcon size={16} strokeWidth={1.75} />
              </button>
            </div>

            {roomRes ? (
              <div className="bg-n-50 rounded-md p-3 mb-4 space-y-1">
                <p className="text-sm font-display font-semibold text-n-900">{roomRes.customer_name || '—'}</p>
                <p className="text-xs font-body text-n-500">
                  {t('dashboard.hotel.checkIn')}: {roomRes.check_in} · {t('dashboard.hotel.checkOut')}: {roomRes.check_out}
                </p>
                <p className="text-xs font-body text-n-500">{roomRes.guests || 1} {t('dashboard.common.guestsSuffix')}</p>
                <div className="pt-1">
                  <Badge variant={STATUS_BADGE_MAP_H[roomRes.status] || 'default'}>
                    {STATUS_KEY_H[roomRes.status] ? t(`dashboard.status.${STATUS_KEY_H[roomRes.status]}`) : roomRes.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.hotel.noActiveReservation')}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors"
              >
                {t('dashboard.common.close')}
              </button>
              <button
                onClick={() => { navigate('/reservas'); setSelected(null); }}
                className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <BookOpen size={13} strokeWidth={1.75} />
                {t('dashboard.common.viewReservations')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Rentacar dashboard ─────────────────────────────────────── */

function VehicleFleet({ units, getState, onSelect }) {
  const t = useT();
  if (!units.length)
    return <p className="text-sm font-body text-n-400 py-4">{t('dashboard.rentacar.noVehiclesRegistered')}</p>;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {units.map(u => {
          const st  = getState(u);
          const s   = CELL[st] || CELL.available;
          const meta = parseVehicleMeta(u);
          const photo = u.images?.[0];
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect?.(u)}
              className={`rounded-sm border border-n-100 overflow-hidden text-left hover:ring-2 hover:ring-ocean-300 transition-all ${s.bg}`}
            >
              {photo ? (
                <div className="w-full aspect-video bg-n-100 overflow-hidden">
                  <img src={photo} alt={u.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-full aspect-video flex items-center justify-center ${s.bg}`}>
                  <Car size={24} strokeWidth={1.25} className={`${s.text} opacity-40`} />
                </div>
              )}
              <div className="p-2.5">
                <p className={`text-xs font-display font-semibold truncate ${s.text}`}>
                  {meta.brand ? `${meta.brand} ${meta.model || ''}`.trim() : u.name}
                </p>
                {meta.plate && (
                  <p className="text-[10px] font-mono text-n-500 mt-0.5 uppercase">{meta.plate}</p>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <span className={`text-[10px] font-mono uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${st}`)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <MapLegend keys={['available', 'occupied', 'maintenance', 'breakdown', 'inactive']} />
    </>
  );
}

function VehicleDetailCard({ unit, state, reservation, onClose, onNavigate }) {
  const t    = useT();
  const s    = CELL[state] || CELL.available;
  const meta = parseVehicleMeta(unit);
  const photo = unit.images?.[0];
  return (
    <div className="bg-white rounded-xl border border-n-200 shadow-2xl w-full max-w-sm">
      {photo && (
        <div className="w-full aspect-video rounded-t-xl overflow-hidden bg-n-100">
          <img src={photo} alt={unit.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-base text-n-900">
              {meta.brand ? `${meta.brand} ${meta.model || ''}`.trim() : unit.name}
            </h3>
            <p className="text-xs font-body text-n-500 mt-0.5">
              {[meta.plate, meta.year, unit.unit_type].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-n-400 hover:text-n-700 rounded">
            <XIcon size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-md mb-4 ${s.bg}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className={`text-xs font-mono font-bold uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${state}`)}</span>
        </div>

        {reservation ? (
          <div className="bg-n-50 rounded-md p-3 mb-4 space-y-1">
            <p className="text-sm font-display font-semibold text-n-900">{reservation.customer_name || '—'}</p>
            <p className="text-xs font-body text-n-500">
              {t('dashboard.rentacar.pickup')}: {reservation.check_in} · {t('dashboard.rentacar.return')}: {reservation.check_out}
            </p>
            <p className="text-xs font-body text-n-500">
              €{Number(reservation.total_price || 0).toFixed(0)}
            </p>
          </div>
        ) : (
          <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.rentacar.vehicleAvailable')}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors"
          >
            {t('dashboard.common.close')}
          </button>
          <button
            onClick={onNavigate}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5"
          >
            <BookOpen size={13} strokeWidth={1.75} />
            {t('dashboard.common.viewReservations')}
          </button>
        </div>
      </div>
    </div>
  );
}

function computeDocAlerts(units, t) {
  const alerts = [];
  const now = new Date();
  units.forEach(u => {
    const meta  = parseVehicleMeta(u);
    const label = meta.plate || u.name;
    const check = (expiry, name) => {
      if (!expiry) return;
      const d    = new Date(expiry);
      const days = Math.ceil((d - now) / 86400000);
      if (days <= 0)  alerts.push({ type: 'expired', msg: t('dashboard.rentacar.expired', { label, name }),                unit: u });
      else if (days <= 30) alerts.push({ type: 'warning', msg: t('dashboard.rentacar.expiresIn', { label, name, days }),   unit: u });
    };
    check(meta.seguro_expiry,   t('dashboard.rentacar.insurance'));
    check(meta.iuc_expiry,      t('dashboard.rentacar.roadTax'));
    check(meta.inspecao_expiry, t('dashboard.rentacar.inspection'));
    if (meta.next_revision_km && meta.current_km) {
      const kmLeft = Number(meta.next_revision_km) - Number(meta.current_km);
      if (kmLeft <= 0)   alerts.push({ type: 'expired', msg: t('dashboard.rentacar.revisionOverdue', { label, km: Math.abs(kmLeft) }), unit: u });
      else if (kmLeft <= 500) alerts.push({ type: 'warning', msg: t('dashboard.rentacar.revisionIn', { label, km: kmLeft }),           unit: u });
    }
  });
  return alerts;
}

function RentacarDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const periodo  = mesAtual();

  const [units,    setUnits]    = useState([]);
  const [todayRes, setTodayRes] = useState([]);
  const [monthRes, setMonthRes] = useState([]);
  const [resumo,   setResumo]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
      listReservations({ from: periodo.inicio, to: periodo.fim }),
      getResumo(periodo.inicio, periodo.fim),
    ])
      .then(([u, tRes, mRes, res]) => {
        setUnits(u || []);
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setResumo(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehicleStatusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in') m[r.unit_id] = 'occupied';
    });
    return m;
  }, [todayRes]);

  function getVehicleState(unit) {
    const us = unitStatus(unit);
    if (us) return us;
    return vehicleStatusMap[unit.id] || 'available';
  }

  const kpis = useMemo(() => {
    const active = units.filter(u => u.is_active !== false);
    const available  = active.filter(u => !['maintenance', 'breakdown', 'inactive'].includes(u.status) && !vehicleStatusMap[u.id]).length;
    const rented     = Object.values(vehicleStatusMap).filter(v => v === 'occupied').length;
    const inMaint    = active.filter(u => ['maintenance', 'breakdown'].includes(u.status)).length;
    return {
      available,
      receita:   resumo?.atual?.receita ?? 0,
      alugados:  rented,
      manutencao: inMaint,
    };
  }, [units, vehicleStatusMap, resumo]);

  const levantamentos = useMemo(() =>
    todayRes.filter(r => r.check_in === TODAY && ['pending', 'confirmed'].includes(r.status)),
    [todayRes]
  );
  const devolucoes = useMemo(() =>
    todayRes.filter(r => r.check_out === TODAY && r.status === 'checked_in'),
    [todayRes]
  );

  const docAlerts = useMemo(() => computeDocAlerts(units, t), [units, t]);

  const vehicleRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['checked_in', 'confirmed', 'pending'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-6">

      {/* Document alerts */}
      {docAlerts.length > 0 && (
        <div className="space-y-2">
          {docAlerts.filter(a => a.type === 'expired').map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md">
              <AlertTriangle size={15} strokeWidth={1.75} className="text-error shrink-0" />
              <p className="text-sm font-body text-error flex-1 font-medium">{a.msg}</p>
              <button onClick={() => navigate('/manutencao')} className="text-xs font-semibold text-error underline shrink-0 whitespace-nowrap">
                {t('dashboard.common.maintenance')}
              </button>
            </div>
          ))}
          {docAlerts.filter(a => a.type === 'warning').slice(0, 3).map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md">
              <AlertTriangle size={15} strokeWidth={1.75} className="text-[#B45309] shrink-0" />
              <p className="text-sm font-body text-[#B45309] flex-1">{a.msg}</p>
              <button onClick={() => navigate('/manutencao')} className="text-xs font-semibold text-[#B45309] underline shrink-0 whitespace-nowrap">
                {t('dashboard.common.maintenance')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t('dashboard.rentacar.availableVehicles')} value={kpis.available}   icon={Car}      />
        <KpiCard label={t('dashboard.rentacar.revenueMonth')}      value={kpis.receita}     icon={Euro}     format="euro" />
        <KpiCard label={t('dashboard.rentacar.activeRentals')}     value={kpis.alugados}    icon={BarChart2}/>
        <KpiCard label={t('dashboard.rentacar.inMaintenance')}     value={kpis.manutencao}  icon={Wrench}   />
      </div>

      {/* Fleet map */}
      <div className="bg-white rounded-lg border border-n-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Car size={15} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide">
            {t('dashboard.rentacar.fleetStatus')}
          </h2>
          <button
            onClick={() => navigate('/manutencao')}
            className="ml-auto text-xs font-body text-ocean-700 hover:underline flex items-center gap-1"
          >
            <Wrench size={11} strokeWidth={1.75} />
            {t('dashboard.common.maintenance')}
          </button>
        </div>
        <VehicleFleet units={units} getState={getVehicleState} onSelect={setSelected} />
      </div>

      {/* Levantamentos + Devoluções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <MoveRight size={14} strokeWidth={1.75} className="text-[#1A7A4A]" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.rentacar.pickupsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-400">{levantamentos.length}</span>
          </div>
          {levantamentos.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-body text-n-400">{t('dashboard.rentacar.noPickupToday')}</p>
          ) : (
            <div className="divide-y divide-n-100">
              {levantamentos.map(r => {
                const u    = units.find(x => x.id === r.unit_id);
                const meta = u ? parseVehicleMeta(u) : {};
                return (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                      <p className="text-xs font-body text-n-400">
                        {u?.name || '—'}{meta.plate ? ` · ${meta.plate}` : ''}
                      </p>
                    </div>
                    <Badge variant={r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                      {r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <MoveLeft size={14} strokeWidth={1.75} className="text-n-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.rentacar.returnsToday')}</h2>
            <span className="ml-auto text-xs font-body text-n-400">{devolucoes.length}</span>
          </div>
          {devolucoes.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-body text-n-400">{t('dashboard.rentacar.noReturnToday')}</p>
          ) : (
            <div className="divide-y divide-n-100">
              {devolucoes.map(r => {
                const u    = units.find(x => x.id === r.unit_id);
                const meta = u ? parseVehicleMeta(u) : {};
                return (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                      <p className="text-xs font-body text-n-400">
                        {u?.name || '—'}{meta.plate ? ` · ${meta.plate}` : ''} · {t('dashboard.rentacar.since', { date: r.check_in })}
                      </p>
                    </div>
                    <Badge variant="info">{t('dashboard.status.return')}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Vehicle detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <VehicleDetailCard
            unit={selected}
            state={getVehicleState(selected)}
            reservation={vehicleRes}
            onClose={() => setSelected(null)}
            onNavigate={() => { navigate('/reservas'); setSelected(null); }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Restaurant dashboard ──────────────────────────────────── */

function TurnoSection({ label, reservations, units, emptyMsg }) {
  const t = useT();
  return (
    <div className="bg-white rounded-lg border border-n-200 shadow-sm">
      <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
        <Clock size={14} strokeWidth={1.75} className="text-n-500" />
        <h2 className="font-display font-semibold text-sm text-n-700">{label}</h2>
        <span className="ml-auto text-xs font-body text-n-400">{reservations.length}</span>
      </div>
      {reservations.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs font-body text-n-400">{emptyMsg}</p>
      ) : (
        <div className="divide-y divide-n-100">
          {reservations.map(r => {
            const unit  = units.find(u => u.id === r.unit_id);
            const umeta = unit ? parseVehicleMeta(unit) : {};
            const tbl   = unit ? (umeta.number ? t('dashboard.restaurant.table', { n: umeta.number }) : unit.name) : t('dashboard.restaurant.noTable');
            let gm = {};
            try { gm = JSON.parse(r.notes_guest || '{}'); } catch {}
            return (
              <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display font-semibold text-n-900 truncate">{r.customer_name || '—'}</p>
                  <p className="text-xs font-body text-n-400">
                    {tbl} · {r.guests} {t('dashboard.common.pax')}{gm.ocasiao ? ` · ${gm.ocasiao}` : ''}
                  </p>
                </div>
                <Badge variant={r.status === 'checked_in' ? 'info' : r.status === 'confirmed' ? 'confirmed' : 'pending'}>
                  {r.status === 'checked_in' ? t('dashboard.status.seated') : r.status === 'confirmed' ? t('dashboard.status.confirmed') : t('dashboard.status.pending')}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TableDetailCard({ unit, state, reservation, onClose, onNavigate }) {
  const t    = useT();
  const s    = CELL[state] || CELL.available;
  const meta = parseVehicleMeta(unit);
  const tbl  = meta.number ? t('dashboard.restaurant.table', { n: meta.number }) : unit.name;
  const zone = ZONE_KEYS[meta.zone] ? t(`dashboard.zones.${meta.zone}`) : (meta.zone || '');
  const cap  = meta.capacity_max || unit.capacity;
  let gm = {};
  if (reservation) { try { gm = JSON.parse(reservation.notes_guest || '{}'); } catch {} }

  return (
    <div className="bg-white rounded-xl border border-n-200 shadow-2xl w-full max-w-sm">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-base text-n-900">{tbl}</h3>
            <p className="text-xs font-body text-n-500 mt-0.5">
              {[zone, cap ? `${cap} ${t('dashboard.common.pax')}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-n-400 hover:text-n-700 rounded">
            <XIcon size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-md mb-4 ${s.bg}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className={`text-xs font-mono font-bold uppercase tracking-wide ${s.text}`}>{t(`dashboard.map.${state}`)}</span>
        </div>

        {reservation ? (
          <div className="bg-n-50 rounded-md p-3 mb-4 space-y-1">
            <p className="text-sm font-display font-semibold text-n-900">{reservation.customer_name || '—'}</p>
            <p className="text-xs font-body text-n-500">
              {reservation.guests} {t('dashboard.restaurant.people')}{gm.turno ? ` · ${t('dashboard.restaurant.shift', { turno: gm.turno })}` : ''}
            </p>
            {gm.ocasiao && <p className="text-xs font-body text-n-400">{gm.ocasiao}</p>}
            {gm.pedidos_especiais && <p className="text-xs font-body text-n-400 italic">{gm.pedidos_especiais}</p>}
          </div>
        ) : (
          <p className="text-sm font-body text-n-400 mb-4">{t('dashboard.restaurant.tableAvailable')}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-md border border-n-200 text-sm font-body text-n-700 hover:bg-n-50 transition-colors">
            {t('dashboard.common.close')}
          </button>
          <button onClick={onNavigate}
            className="flex-1 h-9 rounded-md bg-ocean-700 text-white text-sm font-body font-medium hover:bg-ocean-500 transition-colors flex items-center justify-center gap-1.5">
            <BookOpen size={13} strokeWidth={1.75} />
            {t('dashboard.common.viewReservations')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RestaurantDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const periodo  = mesAtual();

  const [units,     setUnits]     = useState([]);
  const [todayRes,  setTodayRes]  = useState([]);
  const [monthRes,  setMonthRes]  = useState([]);
  const [resumo,    setResumo]    = useState(null);
  const [avgRating, setAvgRating] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
      listReservations({ from: periodo.inicio, to: periodo.fim }),
      getResumo(periodo.inicio, periodo.fim),
      api.get('/reviews/stats').then(r => r.data?.data?.average_rating ?? null).catch(() => null),
    ])
      .then(([u, tRes, mRes, res, avgR]) => {
        setUnits((u || []).filter(x => x.unit_type !== 'menu_item' && x.unit_type !== 'tasting_menu'));
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setResumo(res);
        setAvgRating(avgR);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusMap = useMemo(() => {
    const m = {};
    todayRes.forEach(r => {
      if (r.status === 'checked_in' && !m[r.unit_id])               { m[r.unit_id] = 'occupied'; return; }
      if (['pending', 'confirmed'].includes(r.status) && !m[r.unit_id]) m[r.unit_id] = 'checkin';
    });
    return m;
  }, [todayRes]);

  function getTableState(unit) { return unitStatus(unit) || statusMap[unit.id] || 'available'; }

  const kpis = useMemo(() => ({
    reservasHoje: todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length,
    coversMes:    monthRes.filter(r => ['confirmed', 'checked_in', 'checked_out'].includes(r.status)).reduce((s, r) => s + (r.guests || 0), 0),
    receita:      resumo?.atual?.receita ?? 0,
    rating:       avgRating,
  }), [todayRes, monthRes, resumo, avgRating]);

  const alerts = useMemo(() => {
    const out = [];
    const pendentes = todayRes.filter(r => r.status === 'pending');
    if (pendentes.length > 0)
      out.push({ msg: t('dashboard.restaurant.noConfirmationAlert', { n: pendentes.length }) });
    return out;
  }, [todayRes, t]);

  const shifts = useMemo(() => {
    const a = [], j = [], o = [];
    todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).forEach(r => {
      let meta = {};
      try { meta = JSON.parse(r.notes_guest || '{}'); } catch {}
      if      (meta.turno === 'almoco') a.push(r);
      else if (meta.turno === 'jantar') j.push(r);
      else                              o.push(r);
    });
    return { almoco: a, jantar: j, outros: o };
  }, [todayRes]);

  const tableRes = useMemo(() => {
    if (!selected) return null;
    return todayRes.find(r =>
      r.unit_id === selected.id && ['pending', 'confirmed', 'checked_in'].includes(r.status)
    ) || null;
  }, [selected, todayRes]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-6">

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md">
              <AlertTriangle size={15} strokeWidth={1.75} className="text-[#B45309] shrink-0" />
              <p className="text-sm font-body text-[#B45309] flex-1">{a.msg}</p>
              <button onClick={() => navigate('/reservas')}
                className="text-xs font-semibold text-[#B45309] underline shrink-0 whitespace-nowrap">
                {t('dashboard.common.viewReservations')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t('dashboard.restaurant.reservationsToday')} value={kpis.reservasHoje}                            icon={CalendarDays} />
        <KpiCard label={t('dashboard.restaurant.coversMonth')}       value={kpis.coversMes}                               icon={Users}        />
        <KpiCard label={t('dashboard.restaurant.revenueEstimated')}  value={kpis.receita}                                 icon={Euro}         format="euro" />
        <KpiCard label={t('dashboard.restaurant.avgRating')}         value={kpis.rating ? kpis.rating.toFixed(1) : '—'}  icon={Star}         />
      </div>

      {/* Table map */}
      <div className="bg-white rounded-lg border border-n-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed size={15} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide">
            {t('dashboard.restaurant.tableMap')}
          </h2>
          <button onClick={() => navigate('/unidades')}
            className="ml-auto text-xs font-body text-ocean-700 hover:underline">
            {t('dashboard.restaurant.manageTables')}
          </button>
        </div>
        <TableMap units={units} todayRes={todayRes} onSelect={setSelected} />
      </div>

      {/* Turnos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TurnoSection label={t('dashboard.restaurant.lunch')}  reservations={shifts.almoco} units={units} emptyMsg={t('dashboard.restaurant.noLunchReservations')} />
        <TurnoSection label={t('dashboard.restaurant.dinner')} reservations={shifts.jantar} units={units} emptyMsg={t('dashboard.restaurant.noDinnerReservations')} />
      </div>

      {shifts.outros.length > 0 && (
        <TurnoSection label={t('dashboard.restaurant.noShiftDefined')} reservations={shifts.outros} units={units} emptyMsg="" />
      )}

      {/* Table detail overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <TableDetailCard
            unit={selected}
            state={getTableState(selected)}
            reservation={tableRes}
            onClose={() => setSelected(null)}
            onNavigate={() => { navigate('/reservas'); setSelected(null); }}
          />
        </div>
      )}
    </div>
  );
}

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

function GenericDashboard() {
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

/* ─── Activity dashboard ─────────────────────────────────────── */

const STATUS_BADGE_MAP = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'info', checked_out: 'default', cancelled: 'cancelled',
};
const STATUS_KEY = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'active', checked_out: 'completed', cancelled: 'cancelled',
};

function weekDays() {
  /* Data local do dispositivo, nao UTC -- ver nota junto de TODAY no
     topo do ficheiro. next7[0] tem de bater certo com TODAY. */
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

const DATE_LOCALE = { pt: 'pt-PT', en: 'en-GB', de: 'de-DE', nl: 'nl-NL' };

function formatDayShort(dateStr, lang) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return {
    weekday: d.toLocaleDateString(DATE_LOCALE[lang] || 'pt-PT', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase(),
    day: d.getUTCDate(),
  };
}

function parseTourMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

function ActivityDashboard() {
  const t        = useT();
  const lang     = useUiStore((s) => s.lang);
  const navigate = useNavigate();
  const periodo  = mesAtual();
  const next7    = useMemo(() => weekDays(), []);

  const [tours,        setTours]        = useState([]);
  const [todayRes,     setTodayRes]     = useState([]);
  const [monthRes,     setMonthRes]     = useState([]);
  const [weekRes,      setWeekRes]      = useState([]);
  const [resumo,       setResumo]       = useState(null);
  const [avgRating,    setAvgRating]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [wxAlerts,     setWxAlerts]     = useState([]);
  const [wxDismissed,  setWxDismissed]  = useState(false);

  useEffect(() => {
    Promise.all([
      listUnits(),
      listReservations({ from: TODAY, to: TODAY }),
      listReservations({ from: periodo.inicio, to: periodo.fim }),
      listReservations({ from: TODAY, to: next7[6] }),
      getResumo(periodo.inicio, periodo.fim),
      api.get('/reviews/stats').then(r => r.data?.data?.average_rating ?? null).catch(() => null),
    ])
      .then(([toursData, tRes, mRes, wRes, res, avgR]) => {
        setTours(toursData || []);
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setWeekRes(wRes || []);
        setResumo(res);
        setAvgRating(avgR);

        // Cross-reference weather with upcoming tours
        getWeatherForecast()
          .then(forecast => {
            const resSet = new Set((wRes || [])
              .filter(r => ['pending', 'confirmed'].includes(r.status))
              .map(r => r.check_in));
            const bad = forecast.filter(d => isBadWeather(d) && resSet.has(d.date));
            setWxAlerts(bad.slice(0, 3));
          })
          .catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const active = tours.filter(t => t.status !== 'inactive' && t.is_active !== false);
    const todayActive = todayRes.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status));
    const monthConf   = monthRes.filter(r => ['confirmed', 'checked_in', 'checked_out'].includes(r.status));
    const participants = monthConf.reduce((s, r) => s + (r.guests || 1), 0);
    const totalCap = active.reduce((s, t) => s + (t.capacity || 0), 0);
    const daysInMonth = new Date(periodo.fim).getDate();
    const ocupacao = totalCap > 0
      ? Math.min(100, Math.round((participants / (totalCap * daysInMonth)) * 100))
      : 0;
    return {
      toursHoje:     todayActive.length,
      participantes: participants,
      ocupacao,
      receita:       resumo?.atual?.receita ?? 0,
      rating:        avgRating,
    };
  }, [tours, todayRes, monthRes, resumo, avgRating, periodo.fim]);

  const todayByTour = useMemo(() => {
    const map = {};
    todayRes
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => {
        if (!map[r.unit_id]) map[r.unit_id] = { reservations: [], guests: 0 };
        map[r.unit_id].reservations.push(r);
        map[r.unit_id].guests += r.guests || 1;
      });
    return Object.entries(map)
      .map(([id, data]) => ({ tour: tours.find(t => t.id === id), ...data }))
      .filter(g => g.tour);
  }, [todayRes, tours]);

  const alertas = useMemo(() => ({
    pendentes:       todayRes.filter(r => r.status === 'pending'),
    quaseEsgotados:  todayByTour.filter(g => (g.tour?.capacity || 0) > 0 && g.guests / g.tour.capacity >= 0.8),
  }), [todayRes, todayByTour]);

  const weekCountMap = useMemo(() => {
    const m = Object.fromEntries(next7.map(d => [d, 0]));
    weekRes
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => { if (m[r.check_in] !== undefined) m[r.check_in]++; });
    return m;
  }, [weekRes, next7]);

  const recentRes = useMemo(() =>
    [...monthRes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    [monthRes]
  );

  const topTours = useMemo(() => {
    const counts = {};
    monthRes.filter(r => r.status !== 'cancelled').forEach(r => {
      counts[r.unit_id] = (counts[r.unit_id] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({ tour: tours.find(t => t.id === id), count }))
      .filter(x => x.tour);
  }, [monthRes, tours]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* Weather alert */}
      {!wxDismissed && wxAlerts.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
          <CloudRain size={16} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-body font-semibold text-error mb-1">
              {t('dashboard.activity.badWeatherAlert')}
            </p>
            {wxAlerts.map(wx => {
              const info     = weatherInfo(wx.code);
              const toursOnDay = weekRes.filter(r => r.check_in === wx.date && ['confirmed', 'pending'].includes(r.status));
              return (
                <p key={wx.date} className="text-xs font-body text-red-600">
                  {new Date(wx.date + 'T00:00:00Z').toLocaleDateString(DATE_LOCALE[lang] || 'pt-PT', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}
                  {' — '}{info.label}{wx.precipitation > 0 ? ` (${wx.precipitation}mm)` : ''}
                  {' · '}{t('dashboard.activity.toursScheduled', { n: toursOnDay.length })}
                </p>
              );
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => navigate('/meteorologia')}
              className="text-xs font-body font-semibold text-error hover:underline whitespace-nowrap">
              {t('dashboard.activity.viewDetails')}
            </button>
            <button onClick={() => setWxDismissed(true)}
              className="p-1 rounded text-error hover:bg-red-100 transition-colors">
              <XIcon size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label={t('dashboard.activity.toursToday')}        value={kpis.toursHoje}     icon={Compass} />
        <KpiCard label={t('dashboard.activity.participantsMonth')} value={kpis.participantes} icon={Users} />
        <KpiCard label={t('dashboard.activity.occupancyRate')}     value={kpis.ocupacao}      icon={BarChart2} format="percent" />
        <KpiCard label={t('dashboard.activity.revenueMonth')}      value={kpis.receita}       icon={Euro}     format="euro" />
        <KpiCard label={t('dashboard.restaurant.avgRating')}       value={kpis.rating != null ? Number(kpis.rating).toFixed(1) : '—'} icon={Star} />
      </div>

      {/* Vista do dia + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg border border-n-200 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-md bg-ocean-50 flex items-center justify-center shrink-0">
              <Clock size={14} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide">
              {t('dashboard.activity.toursTodayHeading', { date: TODAY.split('-').reverse().join('/') })}
            </h2>
            <span className="ml-auto text-xs font-body text-n-400">{t('dashboard.activity.activeCount', { n: todayByTour.length })}</span>
          </div>

          {todayByTour.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-ocean-50 flex items-center justify-center mb-4">
                <Compass size={28} strokeWidth={1.5} className="text-ocean-300" />
              </div>
              <p className="text-sm font-display font-semibold text-n-600 mb-1">{t('dashboard.activity.noToursToday')}</p>
              <p className="text-xs font-body text-n-400 mb-4">{t('dashboard.activity.planYourDay')}</p>
              <button
                onClick={() => navigate('/reservas')}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-ocean-700 text-white text-xs font-body font-semibold hover:bg-ocean-500 transition-colors"
              >
                <BookOpen size={13} strokeWidth={1.75} />
                {t('dashboard.activity.newReservation')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-n-100">
              {todayByTour.map(({ tour, reservations, guests }) => {
                const hasActive  = reservations.some(r => r.status === 'checked_in');
                const hasPending = reservations.some(r => r.status === 'pending');
                const meta       = parseTourMeta(tour.description);
                return (
                  <div key={tour.id} className="py-3 flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hasActive ? 'bg-[var(--success)]' : hasPending ? 'bg-[var(--warning)]' : 'bg-ocean-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-n-900 truncate">{tour.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {meta.start_time    && <span className="text-xs font-mono text-n-400">{meta.start_time}</span>}
                        {meta.meeting_point && <span className="text-xs font-body text-n-400 truncate">{meta.meeting_point}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-display font-bold text-ocean-700">
                        {guests}/{tour.capacity || '—'} <span className="text-xs font-body font-normal text-n-500">{t('dashboard.common.pax')}</span>
                      </p>
                      <p className="text-[10px] font-body text-n-400">{reservations.length} {t('dashboard.common.reservationsSuffix')}</p>
                    </div>
                    <Badge variant={hasActive ? 'confirmed' : hasPending ? 'pending' : 'info'}>
                      {hasActive ? t('dashboard.status.inProgress') : hasPending ? t('dashboard.status.pending') : t('dashboard.status.confirmed')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertas + Accoes rapidas */}
        <div className="space-y-3">
          {alertas.pendentes.length > 0 && (
            <div className="bg-[var(--warning-light)] border border-[var(--warning)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} strokeWidth={1.75} className="text-[var(--warning)]" />
                <p className="text-sm font-body font-semibold text-[var(--warning)]">{t('dashboard.activity.pendingReservations')}</p>
                <span className="ml-auto font-bold text-sm text-[var(--warning)]">{alertas.pendentes.length}</span>
              </div>
              {alertas.pendentes.slice(0, 3).map(r => (
                <p key={r.id} className="text-xs font-body text-[var(--warning)] opacity-80 truncate">
                  {tours.find(t => t.id === r.unit_id)?.name || '—'}
                  {r.customer_name ? ` · ${r.customer_name}` : ''}
                </p>
              ))}
              <button onClick={() => navigate('/reservas')} className="mt-2 text-xs font-semibold text-[var(--warning)] underline">
                {t('dashboard.common.viewAll')}
              </button>
            </div>
          )}

          {alertas.quaseEsgotados.length > 0 && (
            <div className="bg-ocean-50 border border-ocean-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} strokeWidth={1.75} className="text-ocean-700" />
                <p className="text-sm font-body font-semibold text-ocean-700">{t('dashboard.activity.almostFull')}</p>
                <span className="ml-auto font-bold text-sm text-ocean-700">{alertas.quaseEsgotados.length}</span>
              </div>
              {alertas.quaseEsgotados.slice(0, 3).map(g => (
                <p key={g.tour.id} className="text-xs font-body text-ocean-600 truncate">
                  {g.tour.name} · {g.guests}/{g.tour.capacity} {t('dashboard.common.pax')}
                </p>
              ))}
            </div>
          )}

          {alertas.pendentes.length === 0 && alertas.quaseEsgotados.length === 0 && (
            <div className="bg-[#ECFDF5] border border-[#BBF7D0] rounded-lg p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
                <CheckCircle size={16} strokeWidth={1.75} className="text-[var(--success)]" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-[var(--success)]">{t('dashboard.activity.allGood')}</p>
                <p className="text-xs font-body text-[var(--success)] opacity-70">{t('dashboard.activity.noPendingToday')}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-n-200 shadow-sm p-4">
            <p className="text-xs font-body font-semibold text-n-500 uppercase tracking-wide mb-3">{t('dashboard.activity.quickActions')}</p>
            <div className="space-y-1.5">
              {[
                { label: t('dashboard.activity.newReservation'), icon: BookOpen,     to: '/reservas'   },
                { label: t('dashboard.activity.viewCalendar'),   icon: CalendarDays, to: '/calendario' },
                { label: t('dashboard.activity.manageTours'),    icon: Compass,      to: '/unidades'   },
              ].map(({ label, icon: Icon, to }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-body text-n-700 hover:bg-ocean-50 hover:text-ocean-700 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-md bg-ocean-50 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                    <Icon size={15} strokeWidth={1.75} className="text-ocean-600" />
                  </div>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Proximos 7 dias */}
      <div className="bg-white rounded-lg border border-n-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={15} strokeWidth={1.75} className="text-n-500" />
          <h2 className="font-display font-semibold text-sm text-n-700 uppercase tracking-wide">{t('dashboard.activity.next7Days')}</h2>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {next7.map(dateStr => {
            const { weekday, day } = formatDayShort(dateStr, lang);
            const count   = weekCountMap[dateStr] || 0;
            const isToday = dateStr === TODAY;
            return (
              <button
                key={dateStr}
                onClick={() => navigate('/calendario')}
                className={`flex flex-col items-center gap-1.5 py-3.5 rounded-md border transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                  isToday
                    ? 'bg-ocean-700 border-ocean-700 text-white'
                    : count > 0
                    ? 'bg-ocean-50 border-ocean-200 text-ocean-700 hover:bg-ocean-100'
                    : 'bg-white border-n-200 text-n-500 hover:border-ocean-200'
                }`}
              >
                <span className={`text-[10px] font-mono uppercase tracking-wide ${isToday ? 'text-ocean-200' : 'text-n-400'}`}>{weekday}</span>
                <span className="font-display font-bold text-sm">{day}</span>
                {count > 0
                  ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-ocean-100 text-ocean-700'}`}>{count} {t('dashboard.activity.resShort')}</span>
                  : <span className="text-[10px] text-n-300">—</span>
                }
              </button>
            );
          })}
        </div>
      </div>

      {/* Reservas recentes + Top tours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <BookOpen size={14} strokeWidth={1.75} className="text-n-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.activity.recentReservations')}</h2>
            <button onClick={() => navigate('/reservas')} className="ml-auto text-xs font-body text-ocean-700 hover:underline">
              {t('dashboard.common.viewAll')}
            </button>
          </div>
          {recentRes.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-n-50 flex items-center justify-center mb-3">
                <BookOpen size={20} strokeWidth={1.5} className="text-n-300" />
              </div>
              <p className="text-xs font-body text-n-400">{t('dashboard.activity.noReservationsMonth')}</p>
            </div>
          ) : (
            <div className="divide-y divide-n-100">
              {recentRes.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-semibold text-n-900 truncate">
                      {tours.find(t => t.id === r.unit_id)?.name || r.units?.name || '—'}
                    </p>
                    <p className="text-[11px] font-body text-n-400 truncate">
                      {r.customer_name || '—'} · {r.check_in}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={STATUS_BADGE_MAP[r.status] || 'default'}>{STATUS_KEY[r.status] ? t(`dashboard.status.${STATUS_KEY[r.status]}`) : r.status}</Badge>
                    <p className="text-xs font-body text-n-400 mt-0.5">{r.guests || 1} {t('dashboard.common.pax')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-n-200 shadow-sm">
          <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
            <TrendingUp size={14} strokeWidth={1.75} className="text-n-500" />
            <h2 className="font-display font-semibold text-sm text-n-700">{t('dashboard.activity.topToursMonth')}</h2>
          </div>
          {topTours.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-n-50 flex items-center justify-center mb-3">
                <TrendingUp size={20} strokeWidth={1.5} className="text-n-300" />
              </div>
              <p className="text-xs font-body text-n-400">{t('dashboard.activity.noDataMonth')}</p>
            </div>
          ) : (
            <div className="divide-y divide-n-100">
              {topTours.map(({ tour, count }, idx) => {
                const meta = parseTourMeta(tour.description);
                return (
                  <div key={tour.id} className="px-5 py-3 flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
                      idx === 0 ? 'bg-sand-300 text-sand-700' : idx === 1 ? 'bg-n-100 text-n-600' : 'bg-n-50 text-n-400'
                    }`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-display font-semibold text-n-900 truncate">{tour.name}</p>
                      <p className="text-[11px] font-body text-n-400">
                        {[meta.duration_hours && `${meta.duration_hours}h`, meta.difficulty].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-display font-bold text-ocean-700">{count}</p>
                      <p className="text-[10px] font-body text-n-400">{t('dashboard.activity.reservationsSuffix')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Trial banner ───────────────────────────────────────────── */

function TrialBanner() {
  const t        = useT();
  const navigate = useNavigate();
  const { isInTrial, isTrialExpired, trialDaysLeft } = usePlan();

  if (isTrialExpired()) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md">
        <AlertTriangle size={16} strokeWidth={1.75} className="text-error shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body font-semibold text-error">{t('dashboard.trial.expiredTitle')}</p>
          <p className="text-xs font-body text-red-600">{t('dashboard.trial.expiredBody')}</p>
        </div>
        <button
          onClick={() => navigate('/definicoes?tab=facturacao')}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-error text-white text-xs font-body font-semibold hover:bg-red-700 transition-colors shrink-0"
        >
          {t('dashboard.trial.viewPlans')}
          <ArrowRight size={13} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  if (!isInTrial()) return null;

  const days    = trialDaysLeft();
  const urgent  = days <= 7;

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-3 px-4 py-3 rounded-md border ${
      urgent ? 'bg-[#FFF7ED] border-[#FDBA74]' : 'bg-ocean-50 border-ocean-200'
    }`}>
      <Clock size={16} strokeWidth={1.75} className={`shrink-0 ${urgent ? 'text-[#B45309]' : 'text-ocean-600'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-body font-semibold ${urgent ? 'text-[#B45309]' : 'text-ocean-700'}`}>
          {days === 0 ? t('dashboard.trial.lastDay') : t('dashboard.trial.daysLeft', { days })}
        </p>
        <p className={`text-xs font-body ${urgent ? 'text-orange-600' : 'text-ocean-600'}`}>
          {t('dashboard.trial.upgradeBody')}
        </p>
      </div>
      <button
        onClick={() => navigate('/definicoes')}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-body font-semibold transition-colors shrink-0 ${
          urgent
            ? 'bg-[#B45309] text-white hover:bg-[#92400E]'
            : 'bg-ocean-700 text-white hover:bg-ocean-500'
        }`}
      >
        {t('dashboard.trial.viewPlans')}
        <ArrowRight size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

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
