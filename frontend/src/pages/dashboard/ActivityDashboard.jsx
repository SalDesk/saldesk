import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, CalendarDays, Users, Compass, Star, AlertTriangle, Clock, TrendingUp, CheckCircle, CloudRain, X as XIcon,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { getWeatherForecast, weatherInfo, isBadWeather } from '../../services/weatherService';
import api from '../../services/api';
import { useT } from '../../i18n';
import useUiStore from '../../store/uiStore';
import KpiCard from '../../components/financial/KpiCard';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual } from './shared';

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

/* Abreviaturas fixas por idioma, em vez de Intl -- o formato 'short' do
   Intl para pt-PT devolve nomes completos ("SEXTA", "SABADO"), grandes
   demais para a celula compacta do dia; isto garante sempre 3 letras. */
const WEEKDAY_ABBR = {
  pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  de: ['So',  'Mo',  'Di',  'Mi',  'Do',  'Fr',  'Sa'],
  nl: ['Zo',  'Ma',  'Di',  'Wo',  'Do',  'Vr',  'Za'],
};

function formatDayShort(dateStr, lang) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return {
    weekday: (WEEKDAY_ABBR[lang] || WEEKDAY_ABBR.pt)[d.getUTCDay()],
    day: d.getUTCDate(),
  };
}

function parseTourMeta(description) {
  if (!description?.startsWith('{')) return {};
  try { return JSON.parse(description); } catch { return {}; }
}

export default function ActivityDashboard() {
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
