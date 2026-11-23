import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Compass, Star, Euro, AlertTriangle } from 'lucide-react';
import { getResumo, getReceita } from '../../services/financeiroService';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { listAssignments } from '../../services/assignmentService';
import { estadiaEm, estadiaNoMes, estadiaProximosDias } from '../../services/reservationRanges';
import { getWeatherForecast, weatherInfo, isBadWeather } from '../../services/weatherService';
import api from '../../services/api';
import { useT } from '../../i18n';
import { formatarNumero } from '../../utils/formatoLingua';
import useUiStore from '../../store/uiStore';
import useAgora from '../../hooks/useAgora';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import DayAgenda from '../../components/dashboard/DayAgenda';
import HeroCard from '../../components/dashboard/HeroCard';
import StatTiles from '../../components/dashboard/StatTiles';
import Shortcuts from '../../components/dashboard/Shortcuts';
import NextDaysStrip from '../../components/dashboard/NextDaysStrip';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { TODAY, mesAtual } from './shared';
import { buildAttentionItems, unpaidReservations } from './dashboardLogic';
import {
  eventosAtividades, serieReceitaAcumulada, variacaoPercentual, valorMedio, porReceber, localeDe,
} from './agendaLogic';

/* ─── Activity dashboard (vista "Hoje") ──────────────────────── */

const ESTADOS_ATIVOS = ['pending', 'confirmed', 'checked_in'];
const ESTADOS_CONFIRMADOS = ['confirmed', 'checked_in', 'checked_out'];

function weekDays() {
  /* Data local do dispositivo, nao UTC -- ver nota junto de TODAY em shared.jsx.
     next7[0] tem de bater certo com TODAY. */
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

function euros(valor) {
  return `€${formatarNumero(Math.round(Number(valor) || 0))}`;
}

export default function ActivityDashboard() {
  const t        = useT();
  const lang     = useUiStore((s) => s.lang);
  const navigate = useNavigate();
  const agora    = useAgora();
  const periodo  = mesAtual();
  const next7    = useMemo(() => weekDays(), []);

  const [tours,        setTours]        = useState([]);
  const [todayRes,     setTodayRes]     = useState([]);
  const [monthRes,     setMonthRes]     = useState([]);
  const [weekRes,      setWeekRes]      = useState([]);
  const [resumo,       setResumo]       = useState(null);
  const [avgRating,    setAvgRating]    = useState(null);
  const [unpaidRes,    setUnpaidRes]    = useState([]);
  const [receitaDia,   setReceitaDia]   = useState([]);
  const [atribuicoes,  setAtribuicoes]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [wxAlerts,     setWxAlerts]     = useState([]);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras.
       /reviews/stats devolve { total, average, distribution }; sem avaliacoes
       (total 0) a media nao existe */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      listReservations(estadiaNoMes()).catch(() => []),
      listReservations(estadiaProximosDias(7)).catch(() => []),
      /* Pagamentos por regularizar de QUALQUER mes: com so as reservas do mes, uma divida de um mes
         anterior nunca aparecia em "Requer atencao" */
      listReservations({ payment_status: 'pending,partial' }).catch(() => []),
      getResumo(periodo.inicio, periodo.fim).catch(() => null),
      api.get('/reviews/stats')
        .then(r => {
          const s = r.data?.data;
          return Number(s?.total) > 0 ? (s.average ?? null) : null;
        })
        .catch(() => null),
      /* Grafico do cartao de destaque: receita por dia, do dia 1 ate hoje */
      getReceita(periodo.inicio, TODAY, 'day').catch(() => []),
      /* Guias da agenda (cruzados no browser por reservation_id) */
      listAssignments().catch(() => []),
    ])
      .then(([toursData, tRes, mRes, wRes, uRes, res, avgR, rDia, atr]) => {
        setTours(toursData || []);
        setTodayRes(tRes || []);
        setMonthRes(mRes || []);
        setWeekRes(wRes || []);
        setUnpaidRes(Array.isArray(uRes) ? uRes : []);
        setResumo(res);
        setAvgRating(avgR);
        setReceitaDia(Array.isArray(rDia) ? rDia : []);
        setAtribuicoes(Array.isArray(atr) ? atr : []);

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
    const monthConf   = monthRes.filter(r => ESTADOS_CONFIRMADOS.includes(r.status));
    const participants = monthConf.reduce((s, r) => s + (r.guests || 1), 0);
    const totalCap = active.reduce((s, t) => s + (t.capacity || 0), 0);
    const daysInMonth = new Date(periodo.fim).getDate();
    const ocupacao = totalCap > 0
      ? Math.min(100, Math.round((participants / (totalCap * daysInMonth)) * 100))
      : 0;
    const receita = Number(resumo?.atual?.receita) || 0;
    return {
      participantes: participants,
      ocupacao,
      receita,
      /* Sem mes anterior na resposta nao ha variacao a mostrar */
      variacao: resumo?.atual && resumo?.anterior
        ? variacaoPercentual(resumo.atual.receita, resumo.anterior.receita)
        : null,
      reservasMes: monthRes.filter(r => r && r.status !== 'cancelled').length,
      valorMedio: valorMedio(receita, monthConf.length),
      rating: avgRating,
    };
  }, [tours, monthRes, resumo, avgRating, periodo.fim]);

  /* Agenda: um evento por (tour, horario) */
  const eventos = useMemo(
    () => eventosAtividades({ reservas: todayRes, tours, atribuicoes }),
    [todayRes, tours, atribuicoes],
  );

  /* Reservas activas de hoje agrupadas por tour (para "quase cheio" em "Requer atencao") */
  const todayByTour = useMemo(() => {
    const map = {};
    todayRes
      .filter(r => ESTADOS_ATIVOS.includes(r.status))
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
      .filter(r => ESTADOS_ATIVOS.includes(r.status))
      .forEach(r => { if (m[r.check_in] !== undefined) m[r.check_in]++; });
    return m;
  }, [weekRes, next7]);

  const porPagar = useMemo(() => unpaidReservations(unpaidRes, TODAY), [unpaidRes]);

  /* Itens do painel "Requer atencao" (meteorologia, pendentes, por pagar, quase cheios) */
  const attentionItems = useMemo(() => buildAttentionItems({
    pendingToday: alertas.pendentes,
    unpaid:       porPagar,
    nearlyFull:   alertas.quaseEsgotados.map(g => ({
      name: g.tour.name, guests: g.guests, capacity: g.tour.capacity,
    })),
    weather: wxAlerts.map(wx => ({
      date:       wx.date,
      label:      t(`weather.conditions.${weatherInfo(wx.code).chave}`),
      toursCount: weekRes.filter(r => r.check_in === wx.date && ['confirmed', 'pending'].includes(r.status)).length,
    })),
  }, t), [alertas, porPagar, wxAlerts, weekRes, t]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  const pessoasHoje = eventos.reduce((s, e) => s + e.pessoas, 0);
  const pendentesHoje = eventos.reduce((s, e) => s + e.pendentes, 0);
  const mesNome = new Date(`${periodo.inicio}T12:00:00`).toLocaleDateString(localeDe(lang), { month: 'long' });

  const tiles = [
    { id: 'reservas', icon: BookOpen, tone: 'ocean', label: t('dashboard.tiles.reservations'), value: String(kpis.reservasMes) },
    { id: 'avaliacao', icon: Star, tone: 'sand', label: t('dashboard.tiles.rating'), value: kpis.rating != null ? Number(kpis.rating).toFixed(1) : '—' },
    { id: 'medio', icon: Euro, tone: 'success', label: t('dashboard.tiles.avgValue'), value: kpis.valorMedio != null ? euros(kpis.valorMedio) : '—' },
    { id: 'receber', icon: AlertTriangle, tone: 'warning', label: t('dashboard.tiles.toReceive'), value: euros(porReceber(porPagar)) },
  ];

  return (
    <div className="space-y-4">
      <HeroCard
        receita={kpis.receita}
        variacao={kpis.variacao}
        serie={serieReceitaAcumulada(receitaDia, periodo.inicio, TODAY)}
        ocupacao={kpis.ocupacao}
        volume={t('dashboard.hero.participants', { n: kpis.participantes })}
        hojeValor={t('dashboard.hero.peopleToday', { n: pessoasHoje })}
        hojeDetalhe={t('dashboard.hero.inTours', { n: eventos.length, p: pendentesHoje })}
        mesNome={mesNome}
      />

      <StatTiles tiles={tiles} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <DayAgenda
          eventos={eventos}
          agoraMin={agora.getHours() * 60 + agora.getMinutes()}
          onAbrir={() => navigate('/calendario')}
          vazio={(
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
          )}
        />

        <div className="space-y-4">
          <AttentionPanel items={attentionItems} />
          <Shortcuts />
          <NextDaysStrip
            dias={next7}
            contagens={weekCountMap}
            hoje={TODAY}
            lang={lang}
            onAbrir={() => navigate('/calendario')}
          />
        </div>
      </div>
    </div>
  );
}
