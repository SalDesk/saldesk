import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Compass } from 'lucide-react';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { listAssignments } from '../../services/assignmentService';
import { estadiaEm, estadiaProximosDias, estadiaUltimosDias } from '../../services/reservationRanges';
import { getWeatherForecast, weatherInfo, isBadWeather } from '../../services/weatherService';
import { useT } from '../../i18n';
import useUiStore from '../../store/uiStore';
import useAgora from '../../hooks/useAgora';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import DayAgenda from '../../components/dashboard/DayAgenda';
import TilesTendencia from '../../components/dashboard/TilesTendencia';
import MareDoDia from '../../components/dashboard/MareDoDia';
import Shortcuts from '../../components/dashboard/Shortcuts';
import NextDaysStrip from '../../components/dashboard/NextDaysStrip';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { eurosInteiros } from '../reservations/shared';
import { TODAY, uniaoPorId } from './shared';
import { buildAttentionItems, unpaidReservations } from './dashboardLogic';
import { eventosAtividades, porReceber } from './agendaLogic';
import {
  curvaMare, serieDias, valorDoDia, variacaoSemana, variacaoSemanaPct,
} from './mareLogic';

/* ─── Activity dashboard (vista "Hoje") ──────────────────────── */

const ESTADOS_ATIVOS = ['pending', 'confirmed', 'checked_in'];

function weekDays() {
  /* Data local do dispositivo, nao UTC -- ver nota junto de TODAY em shared.jsx.
     next7[0] tem de bater certo com TODAY. */
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

export default function ActivityDashboard() {
  const t        = useT();
  const lang     = useUiStore((s) => s.lang);
  const navigate = useNavigate();
  const agora    = useAgora();
  const next7    = useMemo(() => weekDays(), []);

  const [tours,        setTours]        = useState([]);
  const [todayRes,     setTodayRes]     = useState([]);
  /* null = os 13 dias anteriores nao carregaram: sem tendencia nem variacao */
  const [prevRes,      setPrevRes]      = useState(null);
  const [weekRes,      setWeekRes]      = useState([]);
  const [unpaidRes,    setUnpaidRes]    = useState([]);
  const [atribuicoes,  setAtribuicoes]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [wxAlerts,     setWxAlerts]     = useState([]);

  useEffect(() => {
    /* Cada chamada falha para o seu valor vazio: uma falha nao apaga as outras */
    Promise.all([
      listUnits().catch(() => []),
      listReservations(estadiaEm(TODAY)).catch(() => []),
      /* Os 13 dias antes de hoje: tendencia dos ultimos 7 dias e o mesmo dia da semana passada */
      listReservations(estadiaUltimosDias(13)).catch(() => null),
      listReservations(estadiaProximosDias(7)).catch(() => []),
      /* Pagamentos por regularizar de QUALQUER mes: com so as reservas do mes, uma divida de um mes
         anterior nunca aparecia em "Requer atencao" */
      listReservations({ payment_status: 'pending,partial' }).catch(() => []),
      /* Guias da agenda (cruzados no browser por reservation_id) */
      listAssignments().catch(() => []),
    ])
      .then(([toursData, tRes, pRes, wRes, uRes, atr]) => {
        setTours(toursData || []);
        setTodayRes(tRes || []);
        setPrevRes(Array.isArray(pRes) ? pRes : null);
        setWeekRes(wRes || []);
        setUnpaidRes(Array.isArray(uRes) ? uRes : []);
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

  /* Mare do dia: pessoas na rua hora a hora */
  const curva = useMemo(() => curvaMare(todayRes, tours), [todayRes, tours]);

  /* Numeros do dia e tendencia: 14 dias terminados hoje (os 13 anteriores + hoje, sem repetir reservas).
     O ultimo e hoje; o indice 6 e o mesmo dia da semana passada; a tendencia sao os ultimos 7 */
  const numeros = useMemo(() => {
    const valorHoje = valorDoDia(todayRes.filter(r => r.check_in === TODAY));
    /* sem os dias anteriores so se mostra o valor de hoje: nada de tendencia inventada */
    if (prevRes === null) {
      const hoje = serieDias(todayRes, TODAY, 1, 'reservas')[0];
      const gente = serieDias(todayRes, TODAY, 1, 'pessoas')[0];
      return {
        reservas: { hoje, semanaPassada: null, serie: null },
        pessoas: { hoje: gente, semanaPassada: null, serie: null },
        valor: { hoje: valorHoje, semanaPassada: null, serie: null },
      };
    }
    const todas = uniaoPorId(prevRes, todayRes);
    const serie = (medida) => serieDias(todas, TODAY, 14, medida);
    const reservas = serie('reservas');
    const pessoas = serie('pessoas');
    const valores = serie('valor');
    return {
      reservas: { hoje: reservas[13], semanaPassada: reservas[6], serie: reservas.slice(7) },
      pessoas: { hoje: pessoas[13], semanaPassada: pessoas[6], serie: pessoas.slice(7) },
      valor: { hoje: valorHoje, semanaPassada: valores[6], serie: valores.slice(7) },
    };
  }, [prevRes, todayRes]);

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

  const pendentesHoje = eventos.reduce((s, e) => s + e.pendentes, 0);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  /* Delta: subida boa, descida a pedir atencao, sem variacao neutro */
  const tomDe = (delta) => {
    if (!delta) return null;
    if (delta.startsWith('+')) return 'bom';
    if (delta.startsWith('-')) return 'aviso';
    return null;
  };
  const tileDe = (id, label, medida, delta, nota, formatar = String) => ({
    id,
    label,
    value: formatar(medida.hoje),
    delta,
    deltaTom: tomDe(delta),
    deltaTitulo: delta ? t('dashboard.mare.vsLastWeek') : null,
    nota,
    serie: medida.serie,
    serieRotulo: medida.serie ? t('dashboard.mare.sparkline', { label, values: medida.serie.map((v) => formatar(v)).join(', ') }) : null,
  });

  const tiles = [
    tileDe(
      'reservas', t('dashboard.mare.tiles.reservations'), numeros.reservas,
      variacaoSemana(numeros.reservas.hoje, numeros.reservas.semanaPassada),
      pendentesHoje > 0 ? t('dashboard.mare.notes.reservations', { n: pendentesHoje }) : t('dashboard.mare.notes.reservationsNone'),
    ),
    tileDe(
      'pessoas', t('dashboard.mare.tiles.people'), numeros.pessoas,
      variacaoSemanaPct(numeros.pessoas.hoje, numeros.pessoas.semanaPassada),
      t('dashboard.mare.notes.people', { n: eventos.length }),
    ),
    tileDe(
      'valor', t('dashboard.mare.tiles.value'), numeros.valor,
      variacaoSemanaPct(numeros.valor.hoje, numeros.valor.semanaPassada),
      t('dashboard.mare.notes.value'),
      eurosInteiros,
    ),
    {
      id: 'receber',
      label: t('dashboard.tiles.toReceive'),
      value: eurosInteiros(porReceber(porPagar)),
      delta: porPagar.length > 0 ? String(porPagar.length) : null,
      deltaTom: 'aviso',
      nota: t('dashboard.mare.notes.toReceive', { n: porPagar.length }),
      serie: null,
    },
  ];

  return (
    <div className="space-y-4">
      <TilesTendencia tiles={tiles} />

      <MareDoDia curva={curva} agoraMin={agoraMin} reservasHoje={numeros.reservas.hoje} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <DayAgenda
          eventos={eventos}
          agoraMin={agoraMin}
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
