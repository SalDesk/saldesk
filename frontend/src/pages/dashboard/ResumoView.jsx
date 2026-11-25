import { useEffect, useMemo, useState } from 'react';
import { getCanais, getReceita, getResumo, getUnidades } from '../../services/financeiroService';
import { listReservations } from '../../services/reservationsService';
import { listUnits } from '../../services/unitsService';
import { getReviewsStats } from '../../services/analyticsService';
import { estadiaEm } from '../../services/reservationRanges';
import { useT } from '../../i18n';
import { formatarData, formatarNumero, useLingua } from '../../utils/formatoLingua';
import { TODAY } from './shared';
import useAuthStore from '../../store/authStore';
import TilesTendencia from '../../components/dashboard/TilesTendencia';
import GraficoReceita from '../../components/dashboard/GraficoReceita';
import CanaisDonut from '../../components/dashboard/CanaisDonut';
import TopServicos from '../../components/dashboard/TopServicos';
import QuemSaoClientes from '../../components/dashboard/QuemSaoClientes';
import { eurosDecimais, eurosInteiros } from '../reservations/shared';
import {
  alinharSeries, deltaPercentual, deltaPontos, ocupacaoActividades, periodoResumo, listaPossivelmenteCortada, preencherSerie,
  rotuloPeriodo,
} from './resumoLogic';

/* ─── Vista Resumo (partilhada por todos os tipos de operador) ───── */

const PERIODOS = ['7d', '30d', '12m'];
const PERIODO_INICIAL = '30d';

/* Cada pedido falha sozinho: o estado diz se esta a carregar, se correu bem ou se falhou */
const CARREGAR = { estado: 'loading' };

/* Sinal da variacao -> tom do mini-numero: subida boa, descida a pedir atencao, zero neutro */
const tomDe = (delta) => {
  if (!delta) return null;
  if (delta.startsWith('+')) return 'bom';
  if (delta.startsWith('-')) return 'aviso';
  return null;
};

/* Variacao em pontos percentuais como texto com sinal ("+4 pp"); sem base, null */
function textoPontos(pontos, t) {
  if (pontos === null) return null;
  return t('dashboard.resumo.pp', { n: `${pontos > 0 ? '+' : ''}${pontos}` });
}

function EsqueletoTiles() {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4" aria-hidden="true" data-testid="resumo-tiles-carga">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] rounded-2xl bg-n-100 animate-pulse" />)}
    </section>
  );
}

export default function ResumoView() {
  const t = useT();
  const lang = useLingua();
  const opType = useAuthStore((s) => s.operator?.operator_type);

  const [chave, setChave] = useState(PERIODO_INICIAL);
  const periodo = useMemo(() => periodoResumo(chave, TODAY), [chave]);

  const [resumo, setResumo] = useState(CARREGAR);
  const [receita, setReceita] = useState(CARREGAR);
  const [servicos, setServicos] = useState(CARREGAR);
  const [canais, setCanais] = useState(CARREGAR);
  const [avaliacao, setAvaliacao] = useState(CARREGAR);
  const [reservas, setReservas] = useState(CARREGAR);
  const [actividades, setActividades] = useState(CARREGAR);

  /* Numeros do periodo (e do anterior, na mesma resposta) */
  useEffect(() => {
    let ativo = true;
    setResumo(CARREGAR);
    getResumo(periodo.inicio, periodo.fim)
      .then((dados) => ativo && setResumo({ estado: dados ? 'ok' : 'erro', dados }))
      .catch(() => ativo && setResumo({ estado: 'erro' }));
    return () => { ativo = false; };
  }, [periodo]);

  /* Receita do periodo e do anterior: o anterior em falta so tira a linha tracejada */
  useEffect(() => {
    let ativo = true;
    setReceita(CARREGAR);
    Promise.all([
      getReceita(periodo.inicio, periodo.fim, periodo.granularidade).catch(() => null),
      getReceita(periodo.anteriorInicio, periodo.anteriorFim, periodo.granularidade).catch(() => null),
    ]).then(([atual, anterior]) => {
      if (!ativo) return;
      setReceita(Array.isArray(atual)
        ? { estado: 'ok', atual, anterior: Array.isArray(anterior) ? anterior : [] }
        : { estado: 'erro' });
    });
    return () => { ativo = false; };
  }, [periodo]);

  /* Reservas do periodo (todos os tipos: os paises dos clientes); so as actividades pedem ainda os
     servicos e o periodo anterior, para a ocupacao. O pedido do periodo e o mesmo para os dois usos. */
  useEffect(() => {
    let ativo = true;
    setReservas(CARREGAR);
    setActividades(CARREGAR);
    const pedido = listReservations(estadiaEm(periodo.inicio, periodo.fim));
    pedido
      .then((dados) => ativo && setReservas({ estado: 'ok', dados: Array.isArray(dados) ? dados : [] }))
      .catch(() => ativo && setReservas({ estado: 'erro' }));
    if (opType === 'activity') {
      Promise.all([
        listUnits(),
        pedido,
        listReservations(estadiaEm(periodo.anteriorInicio, periodo.anteriorFim)).catch(() => null),
      ]).then(([tours, reservasDoPeriodo, reservasAnteriores]) => {
        if (!ativo) return;
        setActividades({ estado: 'ok', tours, reservas: reservasDoPeriodo, reservasAnteriores });
      }).catch(() => ativo && setActividades({ estado: 'erro' }));
    }
    return () => { ativo = false; };
  }, [opType, periodo]);

  /* Servicos que mais rendem no periodo */
  useEffect(() => {
    let ativo = true;
    setServicos(CARREGAR);
    getUnidades(periodo.inicio, periodo.fim)
      .then((dados) => ativo && setServicos({ estado: 'ok', dados: Array.isArray(dados) ? dados : [] }))
      .catch(() => ativo && setServicos({ estado: 'erro' }));
    return () => { ativo = false; };
  }, [periodo]);

  /* Canais de venda do periodo */
  useEffect(() => {
    let ativo = true;
    setCanais(CARREGAR);
    getCanais(periodo.inicio, periodo.fim)
      .then((dados) => ativo && setCanais({ estado: 'ok', dados: Array.isArray(dados) ? dados : [] }))
      .catch(() => ativo && setCanais({ estado: 'erro' }));
    return () => { ativo = false; };
  }, [periodo]);

  /* Nota media: de todas as avaliacoes, nao depende do periodo */
  useEffect(() => {
    let ativo = true;
    getReviewsStats()
      .then((dados) => ativo && setAvaliacao(dados ? { estado: 'ok', dados } : { estado: 'erro' }))
      .catch(() => ativo && setAvaliacao({ estado: 'erro' }));
    return () => { ativo = false; };
  }, []);

  /* ── Os numeros do periodo ── */
  const tiles = useMemo(() => {
    const atual = resumo.dados?.atual || {};
    const anterior = resumo.dados?.anterior || {};
    const ok = resumo.estado === 'ok';
    const nota = t('dashboard.resumo.vsPrevious');
    const percentual = (id, label, valor, antes, formatar) => {
      const delta = ok ? deltaPercentual(valor, antes) : null;
      return { id, label, value: ok ? formatar(valor) : '—', delta, deltaTom: tomDe(delta), nota };
    };

    const lista = [
      percentual('receita', t('dashboard.resumo.tiles.revenue'), atual.receita, anterior.receita, (v) => eurosInteiros(v)),
      percentual('reservas', t('dashboard.resumo.tiles.bookings'), atual.num_reservas, anterior.num_reservas, (v) => formatarNumero(Number(v || 0))),
      percentual('valor-medio', t('dashboard.resumo.tiles.avgValue'), atual.valor_medio, anterior.valor_medio, (v) => eurosDecimais(v)),
    ];

    /* Ocupacao: hoteis e rent-a-car vem do backend; actividades calculam-se; os outros nao a mostram */
    let ocup = null;
    if (opType === 'hotel' || opType === 'rentacar') {
      ocup = {
        valor: ok ? Number(atual.taxa_ocupacao || 0) : null,
        pontos: ok ? deltaPontos(atual.taxa_ocupacao, anterior.taxa_ocupacao) : null,
      };
    } else if (opType === 'activity') {
      const ac = actividades;
      /* Listas possivelmente cortadas (1000 linhas): sem numero; so a do anterior: sem variacao */
      const valido = ac.estado === 'ok' && !listaPossivelmenteCortada(ac.reservas);
      const valor = valido ? ocupacaoActividades(ac.reservas, ac.tours, periodo.inicio, periodo.fim) : null;
      const antes = valido && ac.reservasAnteriores && !listaPossivelmenteCortada(ac.reservasAnteriores)
        ? ocupacaoActividades(ac.reservasAnteriores, ac.tours, periodo.anteriorInicio, periodo.anteriorFim)
        : null;
      ocup = { valor, pontos: deltaPontos(valor, antes) };
    }
    if (ocup) {
      const delta = textoPontos(ocup.pontos, t);
      lista.push({
        id: 'ocupacao',
        label: t('dashboard.resumo.tiles.occupancy'),
        value: ocup.valor === null ? '—' : `${Math.round(ocup.valor)}%`,
        delta,
        deltaTom: tomDe(delta),
        nota,
      });
    }
    return lista;
  }, [resumo, actividades, opType, periodo, lang, t]);

  /* ── Serie da receita, alinhada por posicao com a do periodo anterior ── */
  const series = useMemo(() => {
    if (receita.estado !== 'ok') return [];
    const { granularidade } = periodo;
    const rotular = (lista) => lista.map((p) => ({ rotulo: rotuloPeriodo(p.periodo, granularidade, t), valor: p.valor }));
    const atual = rotular(preencherSerie(receita.atual, periodo.inicio, periodo.fim, granularidade));
    const anterior = receita.anterior.length > 0
      ? rotular(preencherSerie(receita.anterior, periodo.anteriorInicio, periodo.anteriorFim, granularidade))
      : [];
    return alinharSeries(atual, anterior, granularidade === 'month');
  }, [receita, periodo, lang, t]);

  const formatoData = { day: 'numeric', month: 'short', year: 'numeric' };
  const subtitulo = t('dashboard.resumo.chart.subtitle', {
    from: formatarData(periodo.inicio, formatoData),
    to: formatarData(periodo.fim, formatoData),
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Periodo */}
      <div role="group" aria-label={t('dashboard.resumo.period.label')} className="flex flex-wrap gap-1.5 lg:justify-end">
        {PERIODOS.map((p) => {
          const premido = p === chave;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={premido}
              onClick={() => setChave(p)}
              className={`min-h-[36px] max-md:min-h-[44px] px-3.5 rounded-full border text-[13px] font-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 focus-visible:ring-offset-2 ${
                premido ? 'bg-ocean-900 border-ocean-900 text-white' : 'bg-white border-n-300 text-ocean-700 hover:border-ocean-500'
              }`}
            >
              {t(`dashboard.resumo.period.${p}`)}
            </button>
          );
        })}
      </div>

      {/* Numeros do periodo */}
      {resumo.estado === 'loading' ? <EsqueletoTiles /> : <TilesTendencia tiles={tiles} />}

      {/* Receita contra o periodo anterior */}
      <GraficoReceita series={series} estado={receita.estado} subtitulo={subtitulo} />

      {/* Canais, servicos que mais rendem e clientes: cada bloco carrega e falha sozinho */}
      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <CanaisDonut canais={canais.dados} estado={canais.estado} />
        <TopServicos servicos={servicos.dados} estado={servicos.estado} />
        <QuemSaoClientes avaliacao={avaliacao} reservas={reservas} />
      </div>
    </div>
  );
}
