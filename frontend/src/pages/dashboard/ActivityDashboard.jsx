import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Compass } from 'lucide-react';
import { listUnits } from '../../services/unitsService';
import { listReservations } from '../../services/reservationsService';
import { listAssignments } from '../../services/assignmentService';
import { estadiaEm, estadiaProximosDias, estadiaUltimosDias } from '../../services/reservationRanges';
import { getWeatherForecast, weatherInfo, isBadWeather } from '../../services/weatherService';
import { useT } from '../../i18n';
import useAgora from '../../hooks/useAgora';
import AttentionPanel from '../../components/dashboard/AttentionPanel';
import AgendaSaidas from '../../components/dashboard/AgendaSaidas';
import TilesTendencia from '../../components/dashboard/TilesTendencia';
import MareDoDia from '../../components/dashboard/MareDoDia';
import VentoEMar from '../../components/dashboard/VentoEMar';
import OcupacaoDias from '../../components/dashboard/OcupacaoDias';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ManifestoModal from '../reservations/ManifestoModal';
import { eurosInteiros } from '../reservations/shared';
import { TODAY, uniaoPorId } from './shared';
import { buildAttentionItems, unpaidReservations } from './dashboardLogic';
import { eventosAtividades, porReceber } from './agendaLogic';
import { listaPossivelmenteCortada } from './resumoLogic';
import {
  curvaMare, serieDias, valorDoDia, variacaoSemana, variacaoSemanaPct, ocupacaoDias,
} from './mareLogic';

/* ─── Activity dashboard (vista "Hoje") ──────────────────────── */

const ESTADOS_ATIVOS = ['pending', 'confirmed', 'checked_in'];

/* Os proximos 14 dias: os 7 primeiros alimentam a meteorologia e "Requer atencao", os 14 o mapa de ocupacao */
const DIAS_OCUPACAO = 14;
const DIAS_SEMANA = 7;

/* Lista vazia partilhada: as listas que falharam (null) lem-se como vazias nos calculos, mas o ecra diz que falharam */
const VAZIA = [];

function proximosDias(n) {
  /* Data local do dispositivo, nao UTC -- ver nota junto de TODAY em shared.jsx.
     o primeiro dia tem de bater certo com TODAY. */
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

export default function ActivityDashboard() {
  const t        = useT();
  const navigate = useNavigate();
  const agora    = useAgora();
  const dias14   = useMemo(() => proximosDias(DIAS_OCUPACAO), []);
  const next7    = useMemo(() => dias14.slice(0, DIAS_SEMANA), [dias14]);

  /* null = o pedido falhou (nao e o mesmo que "nao ha nada"): o ecra mostra o erro em vez de zeros */
  const [tours,        setTours]        = useState([]);
  const [todayRes,     setTodayRes]     = useState([]);
  /* null = os 13 dias anteriores nao carregaram: sem tendencia nem variacao */
  const [prevRes,      setPrevRes]      = useState(null);
  /* reservas dos proximos 14 dias (null = falhou) */
  const [res14,         setRes14]        = useState([]);
  const [unpaidRes,    setUnpaidRes]    = useState([]);
  /* null = as atribuicoes nao carregaram: o guia fica desconhecido, nao "sem guia" */
  const [atribuicoes,  setAtribuicoes]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [wxAlerts,     setWxAlerts]     = useState([]);
  /* Vento e mar: a previsao dos proximos dias e o estado do pedido (falha so afecta o seu cartao) */
  const [previsao,      setPrevisao]     = useState([]);
  const [estadoVento,   setEstadoVento]  = useState('a_carregar');
  /* Saida cujo manifesto esta aberto (null = fechado) */
  const [manifesto,    setManifesto]    = useState(null);

  useEffect(() => {
    /* Cada chamada falha para o seu valor: uma falha nao apaga as outras, e null diz ao ecra que falhou */
    Promise.all([
      listUnits().catch(() => null),
      listReservations(estadiaEm(TODAY)).catch(() => null),
      /* Os 13 dias antes de hoje: tendencia dos ultimos 7 dias e o mesmo dia da semana passada */
      listReservations(estadiaUltimosDias(13)).catch(() => null),
      listReservations(estadiaProximosDias(DIAS_OCUPACAO)).catch(() => null),
      /* Pagamentos por regularizar de QUALQUER mes: com so as reservas do mes, uma divida de um mes
         anterior nunca aparecia em "Requer atencao" */
      listReservations({ payment_status: 'pending,partial' }).catch(() => []),
      /* Guias da agenda (cruzados no browser por reservation_id) */
      listAssignments().catch(() => null),
    ])
      .then(([toursData, tRes, pRes, wRes, uRes, atr]) => {
        setTours(Array.isArray(toursData) ? toursData : null);
        setTodayRes(Array.isArray(tRes) ? tRes : null);
        /* 13 dias possivelmente cortados (limite de linhas): valem como falha, sem tendencia nem variacao */
        setPrevRes(Array.isArray(pRes) && !listaPossivelmenteCortada(pRes) ? pRes : null);
        setRes14(Array.isArray(wRes) ? wRes : null);
        setUnpaidRes(Array.isArray(uRes) ? uRes : []);
        setAtribuicoes(Array.isArray(atr) ? atr : null);

        // Cross-reference weather with upcoming tours
        getWeatherForecast()
          .then(forecast => {
            setPrevisao(forecast);
            setEstadoVento(forecast.length > 0 ? 'ok' : 'vazio');
            /* so os primeiros 7 dias: o comportamento do alerta de mau tempo nao muda com os 14 dias */
            const resSet = new Set((Array.isArray(wRes) ? wRes : [])
              .filter(r => ['pending', 'confirmed'].includes(r.status))
              .map(r => r.check_in)
              .filter(d => next7.includes(d)));
            const bad = forecast.filter(d => isBadWeather(d) && resSet.has(d.date));
            setWxAlerts(bad.slice(0, 3));
          })
          .catch(() => setEstadoVento('erro'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* O que falhou (null) lido como lista vazia nos calculos; as marcas abaixo dizem ao ecra o que mostrar */
  const toursFalhou = tours === null;
  const hojeFalhou = todayRes === null;
  const diasFalhou = res14 === null;
  const guiasDesconhecidos = atribuicoes === null;
  const toursL = tours || VAZIA;
  const hojeL = todayRes || VAZIA;
  const dias14L = res14 || VAZIA;
  const atribuicoesL = atribuicoes || VAZIA;
  /* Listas que podem ter ficado pelo limite de linhas (o pedido vem dos check-in mais recentes para tras) */
  const hojeCortada = listaPossivelmenteCortada(todayRes);
  const diasCortados = listaPossivelmenteCortada(res14);

  /* Agenda: um evento por (tour, horario) */
  const eventos = useMemo(
    () => eventosAtividades({ reservas: hojeL, tours: toursL, atribuicoes: atribuicoesL, incluirConcluidas: true }),
    [hojeL, toursL, atribuicoesL],
  );

  /* Reservas activas de hoje agrupadas por tour (para "quase cheio" em "Requer atencao") */
  const todayByTour = useMemo(() => {
    const map = {};
    hojeL
      .filter(r => ESTADOS_ATIVOS.includes(r.status))
      .forEach(r => {
        if (!map[r.unit_id]) map[r.unit_id] = { reservations: [], guests: 0 };
        map[r.unit_id].reservations.push(r);
        map[r.unit_id].guests += r.guests || 1;
      });
    return Object.entries(map)
      .map(([id, data]) => ({ tour: toursL.find(t => t.id === id), ...data }))
      .filter(g => g.tour);
  }, [hojeL, toursL]);

  const alertas = useMemo(() => ({
    pendentes:       hojeL.filter(r => r.status === 'pending'),
    quaseEsgotados:  todayByTour.filter(g => (g.tour?.capacity || 0) > 0 && g.guests / g.tour.capacity >= 0.8),
  }), [hojeL, todayByTour]);

  /* Reservas dos primeiros 7 dias (meteorologia e "Requer atencao") */
  const weekRes = useMemo(() => dias14L.filter(r => next7.includes(r.check_in)), [dias14L, next7]);

  /* Ocupacao por servico activo nos proximos 14 dias */
  const linhasOcupacao = useMemo(() => ocupacaoDias(dias14L, toursL, dias14), [dias14L, toursL, dias14]);

  const porPagar = useMemo(() => unpaidReservations(unpaidRes, TODAY), [unpaidRes]);

  /* Mare do dia: pessoas na rua hora a hora */
  const curva = useMemo(() => curvaMare(hojeL, toursL), [hojeL, toursL]);

  /* Numeros do dia e tendencia: 14 dias terminados hoje (os 13 anteriores + hoje, sem repetir reservas).
     O ultimo e hoje; o indice 6 e o mesmo dia da semana passada; a tendencia sao os ultimos 7 */
  const numeros = useMemo(() => {
    const valorHoje = valorDoDia(hojeL.filter(r => r.check_in === TODAY));
    /* sem os dias anteriores so se mostra o valor de hoje: nada de tendencia inventada */
    if (prevRes === null) {
      const hoje = serieDias(hojeL, TODAY, 1, 'reservas')[0];
      const gente = serieDias(hojeL, TODAY, 1, 'pessoas')[0];
      return {
        reservas: { hoje, semanaPassada: null, serie: null },
        pessoas: { hoje: gente, semanaPassada: null, serie: null },
        valor: { hoje: valorHoje, semanaPassada: null, serie: null },
      };
    }
    const todas = uniaoPorId(prevRes, hojeL);
    const serie = (medida) => serieDias(todas, TODAY, 14, medida);
    const reservas = serie('reservas');
    const pessoas = serie('pessoas');
    const valores = serie('valor');
    return {
      reservas: { hoje: reservas[13], semanaPassada: reservas[6], serie: reservas.slice(7) },
      pessoas: { hoje: pessoas[13], semanaPassada: pessoas[6], serie: pessoas.slice(7) },
      valor: { hoje: valorHoje, semanaPassada: valores[6], serie: valores.slice(7) },
    };
  }, [prevRes, hojeL]);

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
  const tileDe = (id, label, medida, delta, nota, formatar = String) => {
    /* reservas de hoje falhadas: um travessao, sem variacao nem tendencia (zero seria uma mentira) */
    if (hojeFalhou) {
      return { id, label, value: '—', delta: null, deltaTom: null, deltaTitulo: null, nota: null, serie: null, serieRotulo: null };
    }
    return {
      id,
      label,
      value: formatar(medida.hoje),
      delta,
      deltaTom: tomDe(delta),
      deltaTitulo: delta ? t('dashboard.mare.vsLastWeek') : null,
      /* lista de hoje possivelmente cortada: os numeros podem estar por baixo */
      nota: hojeCortada ? t('dashboard.mare.truncated.today') : nota,
      serie: medida.serie,
      serieRotulo: medida.serie ? t('dashboard.mare.sparkline', { label, values: medida.serie.map((v) => formatar(v)).join(', ') }) : null,
    };
  };

  /* Mensagens de erro: a causa mais provavel primeiro */
  const erroHoje = hojeFalhou ? t('dashboard.mare.errors.today') : (toursFalhou ? t('dashboard.mare.errors.units') : null);
  const erroMapa = toursFalhou ? t('dashboard.mare.errors.units') : (diasFalhou ? t('dashboard.mare.errors.days') : null);

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

      <MareDoDia curva={curva} agoraMin={agoraMin} reservasHoje={numeros.reservas.hoje} erro={erroHoje} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4 items-start">
        <AgendaSaidas
          eventos={eventos}
          reservasHoje={hojeL}
          tours={toursL}
          agoraMin={agoraMin}
          erro={erroHoje}
          guiasConhecidos={!guiasDesconhecidos}
          onAbrirManifesto={setManifesto}
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
          <VentoEMar dias={previsao.slice(0, 5)} estado={estadoVento} />
        </div>
      </div>

      {/* Mapa de 14 dias no ecra largo; no telemovel, as barras dos proximos 7 dias */}
      <div className="hidden md:block">
        <OcupacaoDias linhas={linhasOcupacao} dias={dias14} erro={erroMapa} cortada={diasCortados} />
      </div>
      <div className="md:hidden">
        <OcupacaoDias compacto linhas={linhasOcupacao} dias={next7} erro={erroMapa} cortada={diasCortados} />
      </div>

      {manifesto && (
        <ManifestoModal
          open
          onClose={() => setManifesto(null)}
          reservations={hojeL}
          units={toursL}
          tourIdInicial={String(manifesto.id).split('|')[0]}
          dataInicial={TODAY}
        />
      )}
    </div>
  );
}
