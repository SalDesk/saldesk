import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, BookOpen, BarChart2, CalendarDays, Users, Compass, Star,
} from 'lucide-react';
import { getResumo } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { getWeatherForecast, weatherInfo, isBadWeather } from '../../services/weatherService';
import api from '../../services/api';
import { useT } from '../../i18n';
import useUiStore from '../../store/uiStore';
import KpiCard from '../../components/financial/KpiCard';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Table from '../../components/ui/Table';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual } from './shared';
import { buildAttentionItems, unpaidReservations } from './dashboardLogic';

/* ─── Activity dashboard (vista "Hoje") ──────────────────────── */

function weekDays() {
  /* Data local do dispositivo, nao UTC -- ver nota junto de TODAY no
     topo do ficheiro. next7[0] tem de bater certo com TODAY. */
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

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

/* Percentagem de lotacao entre 0 e 100; capacidade em falta ou 0 conta como 0 */
function fillPercent(guests, capacity) {
  const cap = Number(capacity);
  const n = Number(guests);
  if (!(cap > 0) || !(n > 0)) return 0;
  return Math.min(100, Math.round((n / cap) * 100));
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
      /* Sem mes anterior na resposta nao ha variacao a mostrar */
      receitaDelta:  resumo?.atual && resumo?.anterior
        ? Number(resumo.atual.receita || 0) - Number(resumo.anterior.receita || 0)
        : undefined,
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

  /* Itens do painel "Requer atencao" (meteorologia, pendentes, por pagar, quase cheios) */
  const attentionItems = useMemo(() => buildAttentionItems({
    pendingToday: alertas.pendentes,
    unpaid:       unpaidReservations(monthRes, TODAY),
    nearlyFull:   alertas.quaseEsgotados.map(g => ({
      name: g.tour.name, guests: g.guests, capacity: g.tour.capacity,
    })),
    weather: wxAlerts.map(wx => ({
      date:       wx.date,
      label:      weatherInfo(wx.code).label,
      toursCount: weekRes.filter(r => r.check_in === wx.date && ['confirmed', 'pending'].includes(r.status)).length,
    })),
  }, t), [alertas, monthRes, wxAlerts, weekRes, t]);

  /* Linhas da tabela "Tours de hoje" (a tabela usa o id como chave) */
  const tourRows = useMemo(() => todayByTour.map(g => ({ id: g.tour.id, ...g })), [todayByTour]);

  const tourColumns = useMemo(() => [
    {
      key: 'tour',
      label: t('dashboard.activity.colTour'),
      render: ({ tour }) => {
        const meta = parseTourMeta(tour.description);
        return (
          <div className="min-w-0">
            <p className="text-[13px] font-display font-semibold text-n-900 truncate">{tour.name}</p>
            {(meta.start_time || meta.meeting_point) && (
              <p className="text-xs font-body text-n-500 truncate">
                {[meta.start_time, meta.meeting_point].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'capacity',
      label: t('dashboard.activity.colCapacity'),
      width: '30%',
      render: ({ tour, guests }) => {
        const pct = fillPercent(guests, tour.capacity);
        return (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-body font-medium text-n-900 tabular-nums">{guests}/{tour.capacity || '—'}</span>
            <div
              role="progressbar"
              aria-label={t('dashboard.activity.colCapacity')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-1.5 w-16 rounded-full bg-n-100 overflow-hidden"
            >
              <div
                className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-ocean-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'reservations',
      label: t('dashboard.activity.colReservations'),
      align: 'right',
      render: ({ reservations }) => <span className="text-[13px] font-body tabular-nums">{reservations.length}</span>,
    },
    {
      key: 'status',
      label: t('common.status'),
      render: ({ reservations }) => {
        const hasActive  = reservations.some(r => r.status === 'checked_in');
        const hasPending = reservations.some(r => r.status === 'pending');
        return (
          <Badge variant={hasActive ? 'confirmed' : hasPending ? 'pending' : 'info'}>
            {hasActive ? t('dashboard.status.inProgress') : hasPending ? t('dashboard.status.pending') : t('dashboard.status.confirmed')}
          </Badge>
        );
      },
    },
  ], [t]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label={t('dashboard.activity.toursToday')}        value={kpis.toursHoje}     icon={Compass} />
        <KpiCard label={t('dashboard.activity.participantsMonth')} value={kpis.participantes} icon={Users} />
        <KpiCard label={t('dashboard.activity.occupancyRate')}     value={kpis.ocupacao}      icon={BarChart2} format="percent" />
        <KpiCard
          label={t('dashboard.activity.revenueMonth')}
          value={kpis.receita}
          delta={kpis.receitaDelta}
          deltaLabel={t('dashboard.summary.vsPrevMonth')}
          icon={Euro}
          format="euro"
        />
        <KpiCard label={t('dashboard.restaurant.avgRating')}       value={kpis.rating != null ? Number(kpis.rating).toFixed(1) : '—'} icon={Star} />
      </div>

      {/* Tours de hoje + Requer atencao */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="bg-white border border-n-200 rounded-sm">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
            <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.activity.toursTodayTitle')}</h2>
            <span className="ml-auto text-xs font-body text-n-500 tabular-nums">{t('dashboard.activity.activeCount', { n: todayByTour.length })}</span>
          </header>
          {tourRows.length === 0 ? (
            <EmptyState
              icon={Compass}
              title={t('dashboard.activity.noToursToday')}
              description={t('dashboard.activity.planYourDay')}
              action={(
                <Button size="sm" icon={BookOpen} onClick={() => navigate('/reservas')}>
                  {t('dashboard.activity.newReservation')}
                </Button>
              )}
            />
          ) : (
            <Table columns={tourColumns} rows={tourRows} />
          )}
        </section>

        <AttentionPanel items={attentionItems} />
      </div>

      {/* Proximos 7 dias */}
      <section className="bg-white border border-n-200 rounded-sm">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-n-200">
          <CalendarDays size={14} strokeWidth={1.75} className="text-n-500" aria-hidden="true" />
          <h2 className="font-display font-semibold text-sm text-n-900">{t('dashboard.activity.next7Days')}</h2>
        </header>
        <div className="grid grid-cols-7 gap-1.5 p-3">
          {next7.map(dateStr => {
            const { weekday, day } = formatDayShort(dateStr, lang);
            const count   = weekCountMap[dateStr] || 0;
            const isToday = dateStr === TODAY;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => navigate('/calendario')}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 ${
                  isToday
                    ? 'bg-ocean-700 border-ocean-700 text-white'
                    : count > 0
                    ? 'bg-ocean-50 border-ocean-100 text-ocean-700 hover:bg-ocean-100'
                    : 'bg-white border-n-200 text-n-500 hover:bg-n-50'
                }`}
              >
                <span className={`text-[11px] font-body uppercase ${isToday ? 'text-ocean-100' : 'text-n-500'}`}>{weekday}</span>
                <span className="font-display font-semibold text-sm tabular-nums">{day}</span>
                <span className="h-4 flex items-center">
                  {count > 0 && (
                    <span className={`text-[10px] font-body font-semibold px-1.5 rounded-full tabular-nums ${isToday ? 'bg-white/20 text-white' : 'bg-ocean-100 text-ocean-700'}`}>{count} {t('dashboard.activity.resShort')}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
