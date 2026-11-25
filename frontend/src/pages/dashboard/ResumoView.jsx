import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp } from 'lucide-react';
import { getReceita, getResumo, getUnidades } from '../../services/financeiroService';
import { listReservations } from '../../services/reservationsService';
import { listUnits } from '../../services/unitsService';
import { estadiaEm } from '../../services/reservationRanges';
import { useT } from '../../i18n';
import { formatarData, formatarNumero, useLingua } from '../../utils/formatoLingua';
import { TODAY } from './shared';
import useAuthStore from '../../store/authStore';
import TilesTendencia from '../../components/dashboard/TilesTendencia';
import GraficoReceita from '../../components/dashboard/GraficoReceita';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { eurosDecimais, eurosInteiros } from '../reservations/shared';
import {
  alinharSeries, deltaPercentual, deltaPontos, ocupacaoActividades, periodoResumo, listaPossivelmenteCortada, preencherSerie,
  rotuloPeriodo,
} from './resumoLogic';

/* ─── Vista Resumo (partilhada por todos os tipos de operador) ───── */

const PERIODOS = ['7d', '30d', '12m'];
const PERIODO_INICIAL = '30d';

const STATUS_BADGE_MAP = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'info', checked_out: 'default', cancelled: 'cancelled',
};
const STATUS_KEY = {
  pending: 'pending', confirmed: 'confirmed',
  checked_in: 'active', checked_out: 'completed', cancelled: 'cancelled',
};

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

/* Cartao com titulo, usado nos blocos de baixo */
function Bloco({ icon: Icon, title, action, children }) {
  return (
    <section className="bg-white border border-n-200 rounded-sm">
      <div className="px-4 py-3 border-b border-n-200 flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} className="text-n-500" />
        <h2 className="font-display font-semibold text-sm text-n-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ResumoView() {
  const t = useT();
  const lang = useLingua();
  const navigate = useNavigate();
  const opType = useAuthStore((s) => s.operator?.operator_type);

  const [chave, setChave] = useState(PERIODO_INICIAL);
  const periodo = useMemo(() => periodoResumo(chave, TODAY), [chave]);

  const [resumo, setResumo] = useState(CARREGAR);
  const [receita, setReceita] = useState(CARREGAR);
  const [servicos, setServicos] = useState(CARREGAR);
  const [recentes, setRecentes] = useState(CARREGAR);
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

  /* Reservas do periodo e do anterior, mais os servicos: so as actividades precisam (ocupacao) */
  useEffect(() => {
    if (opType !== 'activity') return undefined;
    let ativo = true;
    setActividades(CARREGAR);
    Promise.all([
      listUnits(),
      listReservations(estadiaEm(periodo.inicio, periodo.fim)),
      listReservations(estadiaEm(periodo.anteriorInicio, periodo.anteriorFim)).catch(() => null),
    ]).then(([tours, reservas, reservasAnteriores]) => {
      if (!ativo) return;
      setActividades({ estado: 'ok', tours, reservas, reservasAnteriores });
    }).catch(() => ativo && setActividades({ estado: 'erro' }));
    return () => { ativo = false; };
  }, [opType, periodo]);

  /* Servicos mais vendidos do periodo (o rebuild dos blocos de baixo e a tarefa seguinte) */
  useEffect(() => {
    let ativo = true;
    setServicos(CARREGAR);
    getUnidades(periodo.inicio, periodo.fim)
      .then((dados) => ativo && setServicos({ estado: 'ok', dados: Array.isArray(dados) ? dados : [] }))
      .catch(() => ativo && setServicos({ estado: 'ok', dados: [] }));
    return () => { ativo = false; };
  }, [periodo]);

  /* As 5 reservas criadas mais recentemente, de qualquer mes */
  useEffect(() => {
    let ativo = true;
    listReservations({ order_by: 'created_at', limit: 5 })
      .then((dados) => ativo && setRecentes({ estado: 'ok', dados: Array.isArray(dados) ? dados : [] }))
      .catch(() => ativo && setRecentes({ estado: 'ok', dados: [] }));
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

  /* Servicos mais vendidos: ate 5, por receita */
  const topServicos = useMemo(() => (
    [...(servicos.dados || [])].sort((a, b) => Number(b.receita || 0) - Number(a.receita || 0)).slice(0, 5)
  ), [servicos]);

  /* Reservas recentes: as 5 criadas mais recentemente */
  const reservasRecentes = useMemo(() => (
    [...(recentes.dados || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)
  ), [recentes]);

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

      {/* Servicos mais vendidos + Reservas recentes (a refazer na tarefa seguinte) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloco icon={TrendingUp} title={t('dashboard.summary.topServices')}>
          {servicos.estado === 'loading' ? (
            <div className="flex justify-center py-8"><LoadingSpinner size={20} /></div>
          ) : topServicos.length === 0 ? (
            <EmptyState icon={TrendingUp} title={t('dashboard.summary.topServicesEmpty')} />
          ) : (
            <div className="divide-y divide-n-100">
              {topServicos.map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
                    idx === 0 ? 'bg-sand-300 text-sand-600' : idx === 1 ? 'bg-n-100 text-n-600' : 'bg-n-50 text-n-400'
                  }`}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-semibold text-n-900 truncate">{s.name}</p>
                    <p className="text-[11px] font-body text-n-400">
                      {s.num_reservas || 0} {t('dashboard.activity.reservationsSuffix')}
                    </p>
                  </div>
                  <p className="text-sm font-display font-bold text-ocean-700 shrink-0">
                    {`€${formatarNumero(Math.round(Number(s.receita || 0)))}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco
          icon={BookOpen}
          title={t('dashboard.activity.recentReservations')}
          action={(
            <button onClick={() => navigate('/reservas')} className="ml-auto text-xs font-body text-ocean-700 hover:underline">
              {t('dashboard.common.viewAll')}
            </button>
          )}
        >
          {recentes.estado === 'loading' ? (
            <div className="flex justify-center py-8"><LoadingSpinner size={20} /></div>
          ) : reservasRecentes.length === 0 ? (
            <EmptyState icon={BookOpen} title={t('dashboard.activity.noRecentReservations')} />
          ) : (
            <div className="divide-y divide-n-100">
              {reservasRecentes.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-semibold text-n-900 truncate">
                      {r.units?.name || r.unit?.name || '—'}
                    </p>
                    <p className="text-[11px] font-body text-n-400 truncate">
                      {r.customer_name || '—'} · {r.check_in}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={STATUS_BADGE_MAP[r.status] || 'default'}>
                      {STATUS_KEY[r.status] ? t(`dashboard.status.${STATUS_KEY[r.status]}`) : r.status}
                    </Badge>
                    <p className="text-xs font-body text-n-400 mt-0.5">{r.guests || 1} {t('dashboard.common.pax')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Bloco>
      </div>
    </div>
  );
}
