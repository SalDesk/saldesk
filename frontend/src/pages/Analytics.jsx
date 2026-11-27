import { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Star,
  Users, Globe, BarChart2, RefreshCw, Mail,
  MousePointerClick, Building2, Edit2, Check,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAnalyticsStats, getReviewsStats, getMarketingStats } from '../services/analyticsService';
import { listCustomers } from '../services/customersService';
import { getResumo, getUnidades } from '../services/financeiroService';
import { listUnits } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MareStat from '../components/shared/MareStat';
import { IconBtn, EDIT_HOVER } from '../components/shared/IconBtn';
import DicaGrafico from '../components/financial/DicaGrafico';
import { useT } from '../i18n';
import { formatarData, formatarNumero, useLingua } from '../utils/formatoLingua';

const COMP_KEY = 'saldesk_competition_v1';
function loadComp() { try { return JSON.parse(localStorage.getItem(COMP_KEY) || '{}'); } catch { return {}; } }
function saveComp(c) { localStorage.setItem(COMP_KEY, JSON.stringify(c)); }

/* ── helpers ── */
function ultimos30() {
  const fim    = new Date();
  const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
  const fmt = d => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(fim) };
}

/* GET /reviews/stats devolve { total, average, distribution }; "average_rating" nunca existiu no endpoint
   (antes o rating ficava sempre vazio e o score usava o valor por omissao). */
function ratingDe(stats) {
  const n = Number(stats?.average ?? stats?.average_rating ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v) {
  return `€${formatarNumero(Math.round(Number(v || 0)))}`;
}

/* Paises com nome em analytics.countries; um codigo fora da lista mostra-se tal e qual */
const PAISES = ['DE', 'GB', 'NL', 'FR', 'PT', 'CV', 'US', 'ES', 'IT', 'BE', 'AT', 'CH', 'IE', 'PL', 'BR'];
function nomePais(codigo, t) {
  return PAISES.includes(codigo) ? t(`analytics.countries.${codigo}`) : codigo;
}

/* Estilo Mare: cartao de pagina, titulo de cartao e figuras (dinheiro, contagens, percentagens) */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const NUM = 'font-mono tabular-nums';

/* Grafico e lista de origens: a origem principal em areia, as restantes em oceano */
function corDaOrigem(i) { return i === 0 ? 'var(--sand-500)' : 'var(--ocean-500)'; }
const TICK_GRAFICO = { fontSize: 12, fontFamily: 'DM Mono', fill: 'var(--n500)' };

/* ── Health Score computation ── */
function computeHealthScore(resumo, reviewsStats, stats) {
  if (stats?.health_score != null) {
    return {
      score: Math.round(stats.health_score),
      components: stats.health_components || {},
    };
  }

  const components = { crescimento: 0, ocupacao: 0, avaliacoes: 0, fidelizacao: 15 };

  const varRec = resumo?.variacao?.receita;
  if (varRec != null) {
    if      (varRec > 20)  components.crescimento = 25;
    else if (varRec > 10)  components.crescimento = 20;
    else if (varRec > 0)   components.crescimento = 15;
    else if (varRec > -10) components.crescimento = 8;
    else                   components.crescimento = 3;
  } else {
    components.crescimento = 12;
  }

  const occ = resumo?.atual?.taxa_ocupacao;
  if (occ != null) {
    if      (occ > 80) components.ocupacao = 25;
    else if (occ > 60) components.ocupacao = 20;
    else if (occ > 40) components.ocupacao = 14;
    else if (occ > 20) components.ocupacao = 8;
    else               components.ocupacao = 3;
  } else {
    components.ocupacao = 12;
  }

  const rating = ratingDe(reviewsStats);
  if (rating > 0) {
    if      (rating >= 4.8) components.avaliacoes = 25;
    else if (rating >= 4.5) components.avaliacoes = 21;
    else if (rating >= 4.0) components.avaliacoes = 16;
    else if (rating >= 3.5) components.avaliacoes = 10;
    else                    components.avaliacoes = 5;
  } else {
    components.avaliacoes = 12;
  }

  const score = Math.min(100, Math.round(
    components.crescimento + components.ocupacao + components.avaliacoes + components.fidelizacao,
  ));

  return { score, components };
}

/* ── HealthGauge SVG ── */
function HealthGauge({ score }) {
  const t = useT();
  if (score == null) {
    return (
      <div className="w-40 h-40 flex items-center justify-center rounded-full border-[12px] border-n-200 mx-auto">
        <span className="text-xs font-body text-n-500">{t('analytics.noData')}</span>
      </div>
    );
  }

  const r     = 60;
  const circ  = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color  = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--sand-500)' : 'var(--error)';
  const label  = t(`analytics.health.${score >= 70 ? 'good' : score >= 50 ? 'moderate' : 'critical'}`);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 160 160" className="w-40 h-40">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--n200)" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="78" textAnchor="middle" fill="var(--n900)"
          style={{ fontSize: '30px', fontWeight: '700', fontFamily: 'Sora' }}>
          {score}
        </text>
        <text x="80" y="98" textAnchor="middle" fill="var(--n500)"
          style={{ fontSize: '11px', fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          /100
        </text>
      </svg>
      <span className="text-xs font-mono font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

/* ── ScoreBar ── */
function ScoreBar({ label, value, max = 25, color = 'var(--ocean-700)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-body text-n-600">{label}</span>
        <span className={`text-xs ${NUM} font-semibold text-n-800`}>{value}<span className="text-n-500">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── FunnelRow ── */
function FunnelRow({ label, value, max, color, pct }) {
  const barPct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 sm:w-36 shrink-0">
        <p className="text-xs font-body text-n-600 truncate">{label}</p>
      </div>
      <div className="flex-1 min-w-0 h-6 bg-n-100 rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${barPct}%`, backgroundColor: color, minWidth: barPct > 0 ? '0.5rem' : 0 }}
        />
      </div>
      <span className={`w-14 text-right text-xs ${NUM} font-semibold text-n-800 shrink-0`}>{formatarNumero(value)}</span>
      {pct != null && (
        <span className={`w-12 text-right text-xs ${NUM} text-n-600 shrink-0`}>{pct.toFixed(1)}%</span>
      )}
    </div>
  );
}

/* ── Posicao do preco face ao concorrente (limiares 5 e 20) ── */
function competitionPosition(ownPrice, compPrice, t) {
  if (!(ownPrice > 0 && compPrice > 0)) return { position: null, label: '—', color: 'text-n-500' };
  const diff = ((ownPrice - compPrice) / compPrice) * 100;
  const n = Math.round(diff);
  if (diff > 20)  return { position: 'high',   label: t('analytics.above', { n }), color: 'text-[var(--error)]' };
  if (diff > 5)   return { position: 'slight', label: t('analytics.above', { n }), color: 'text-[var(--warning)]' };
  if (diff < -20) return { position: 'low',    label: t('analytics.below', { n }), color: 'text-[var(--success)]' };
  if (diff < -5)  return { position: 'slight', label: t('analytics.below', { n }), color: 'text-ocean-700' };
  return { position: null, label: t('analytics.atAverage'), color: 'text-[var(--success)]' };
}

/* ── Dica do grafico de origens: pais, clientes e percentagem ── */
function DicaOrigem({ active, payload }) {
  const t = useT();
  useLingua();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <DicaGrafico>
      <p className="font-semibold text-n-800 mb-1">{nomePais(d.country_code, t)}</p>
      <p className="font-mono tabular-nums text-ocean-900 font-bold">
        {t('analytics.customersTooltip', { n: payload[0].value, pct: d.pct.toFixed(1) })}
      </p>
    </DicaGrafico>
  );
}

/* ── Main Analytics ── */
export default function Analytics() {
  const t = useT();
  useLingua();
  const [loading, setLoading] = useState(true);
  const [resumo,  setResumo]  = useState(null);
  const [reviews, setReviews] = useState(null);
  const [stats,   setStats]   = useState(null);
  const [mktg,    setMktg]    = useState(null);
  const [origins, setOrigins] = useState([]);
  const [units,   setUnits]   = useState([]);
  const [desempenho, setDesempenho] = useState([]);
  const [comp,    setComp]    = useState(loadComp);
  const [editComp, setEditComp] = useState(null);
  const [compDraft, setCompDraft] = useState({});

  const carregar = async () => {
    setLoading(true);
    try {
      const p = ultimos30();
      const [r, rv, st, mk, customers, un, des] = await Promise.all([
        getResumo(p.inicio, p.fim).catch(() => null),
        getReviewsStats().catch(() => null),
        getAnalyticsStats().catch(() => null),
        getMarketingStats().catch(() => null),
        listCustomers({}).catch(() => []),
        listUnits().catch(() => []),
        getUnidades(p.inicio, p.fim).catch(() => []),
      ]);
      setResumo(r);
      setReviews(rv);
      setStats(st);
      setMktg(mk);
      setUnits(un || []);
      setDesempenho(Array.isArray(des) ? des : []);

      const source = st?.customer_origins || buildOrigins(customers);
      setOrigins(source);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  function buildOrigins(customers) {
    const map = {};
    (customers || []).forEach(c => {
      if (c.country_code) map[c.country_code] = (map[c.country_code] || 0) + 1;
    });
    const total = Object.values(map).reduce((s, n) => s + n, 0) || 1;
    return Object.entries(map)
      .map(([code, count]) => ({ country_code: code, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  const { score, components } = computeHealthScore(resumo, reviews, stats);

  const funnel = stats?.conversion_funnel || mktg?.funnel || null;

  /* Popularidade por tour: reservas dos ultimos 30 dias (GET /financial/unidades) relativas ao tour mais
     reservado, que fica a 100%. Antes era um indice inventado com Math.random(). */
  const maisReservados = [...desempenho]
    .sort((a, b) => Number(b.num_reservas || 0) - Number(a.num_reservas || 0))
    .slice(0, 5);
  const maxReservas = Number(maisReservados[0]?.num_reservas || 0);

  const weekly = stats?.weekly_summary || {
    revenue:       resumo?.atual?.receita       || null,
    reservas:      resumo?.atual?.num_reservas  || null,
    novos_clientes: null,
    rating_medio:  ratingDe(reviews) || null,
  };

  const ratingNum = ratingDe(reviews);

  const SCORE_COMPONENTS = [
    { label: t('analytics.components.growth'),    value: components.crescimento ?? 0, max: 25, color: 'var(--ocean-700)' },
    { label: t('analytics.components.occupancy'), value: components.ocupacao    ?? 0, max: 25, color: 'var(--ocean-500)' },
    { label: t('analytics.components.reviews'),   value: components.avaliacoes  ?? 0, max: 25, color: 'var(--sand-500)' },
    { label: t('analytics.components.loyalty'),   value: components.fidelizacao ?? 0, max: 25, color: 'var(--ocean-400)' },
  ];

  /* Concorrencia: o preco do concorrente edita-se na propria celula */
  function guardarPreco(u, c) {
    const updated = { ...comp, [u.id]: { ...c, price: Number(compDraft[u.id] || 0) } };
    setComp(updated); saveComp(updated);
    setEditComp(null); setCompDraft({});
  }

  const compColumns = [
    {
      key: 'name', label: t('analytics.tour'),
      render: u => <span className="block max-w-[160px] truncate font-body font-semibold text-n-800">{u.name}</span>,
    },
    {
      key: 'own', label: t('analytics.ownPrice'),
      render: u => (
        <span className={`${NUM} font-bold text-ocean-900`}>
          {Number(u.base_price || 0) > 0 ? `€${Number(u.base_price || 0)}` : '—'}
        </span>
      ),
    },
    {
      key: 'comp', label: t('analytics.competitorPrice'),
      render: u => {
        const c = comp[u.id] || {};
        const compPrice = Number(c.price || 0);
        if (editComp === u.id) {
          return (
            <div className="w-28">
              <Input
                type="number" min="0" step="1"
                aria-label={t('analytics.competitorPriceAria')}
                value={compDraft[u.id] ?? c.price ?? ''}
                onChange={e => setCompDraft(p => ({ ...p, [u.id]: e.target.value }))}
                className="font-mono"
                placeholder={t('analytics.pricePlaceholder')}
                autoFocus
              />
            </div>
          );
        }
        return (
          <span className={`${NUM} text-n-700`}>
            {compPrice > 0 ? `€${compPrice}` : <span className="text-n-500 text-xs">{t('analytics.notSet')}</span>}
          </span>
        );
      },
    },
    {
      key: 'position', label: t('analytics.marketPosition'),
      render: u => {
        const c = comp[u.id] || {};
        const pos = competitionPosition(Number(u.base_price || 0), Number(c.price || 0), t);
        return (
          <>
            <span className={`text-xs ${NUM} font-semibold ${pos.color}`}>{pos.label}</span>
            {pos.position === 'high' && (
              <p className="text-xs font-body text-n-600">{t('analytics.reduceTip')}</p>
            )}
          </>
        );
      },
    },
    {
      key: 'acoes', label: '',
      render: u => {
        const c = comp[u.id] || {};
        return editComp === u.id ? (
          <IconBtn
            icon={Check}
            label={t('analytics.savePrice')}
            onClick={() => guardarPreco(u, c)}
            hover="hover:bg-[var(--success-light)]"
            className="text-[var(--success)]"
          />
        ) : (
          <IconBtn
            icon={Edit2}
            label={t('analytics.editPrice')}
            onClick={() => { setEditComp(u.id); setCompDraft(p => ({ ...p, [u.id]: c.price || '' })); }}
            hover={EDIT_HOVER}
          />
        );
      },
    },
  ];

  /* Variacao do resumo: sinal e valor em texto (nunca so a cor); sem variacao nao ha pista */
  function pistaVariacao(delta) {
    if (delta == null) return undefined;
    return `${delta > 0 ? '+' : ''}${delta}%`;
  }
  function tomVariacao(delta) {
    if (delta == null || delta === 0) return 'default';
    return delta > 0 ? 'bom' : 'aviso';
  }
  const varReceita  = resumo?.variacao?.receita != null ? Math.round(resumo.variacao.receita) : null;
  const varReservas = resumo?.variacao?.num_reservas != null ? Math.round(resumo.variacao.num_reservas) : null;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.gestao')}
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" className="min-h-11 md:min-h-0" onClick={carregar} loading={loading}>
            {t('analytics.refresh')}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : (
        <div className="space-y-5">

          {/* Score de Saude + componentes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-5`}>{t('analytics.healthScoreTitle')}</h3>
              <HealthGauge score={score} />
              {score == null && (
                <p className="text-center text-xs font-body text-n-500 mt-3">
                  {t('analytics.configureBefore')}<span className="font-mono">/financial/stats</span>{t('analytics.configureAfter')}
                </p>
              )}
            </section>

            <section className={`${CARTAO} lg:col-span-2`}>
              <h3 className={`${TITULO} mb-5`}>{t('analytics.scoreComponents')}</h3>
              <div className="space-y-4">
                {SCORE_COMPONENTS.map(c => (
                  <ScoreBar key={c.label} label={c.label} value={c.value} max={c.max} color={c.color} />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-mare-card">
                <p className="text-xs font-body text-n-500">
                  {t('analytics.scoreNote')}
                  {resumo == null && t('analytics.scoreNoteNoData')}
                </p>
              </div>
            </section>
          </div>

          {/* Resumo semanal */}
          <div>
            <h3 className={`${TITULO} mb-3`}>{t('analytics.summaryTitle')}</h3>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
              <MareStat
                icon={TrendingUp}
                label={t('analytics.revenue')}
                value={weekly.revenue != null ? fmtMoney(weekly.revenue) : '—'}
                hint={pistaVariacao(varReceita)}
                tone={tomVariacao(varReceita)}
              />
              <MareStat
                icon={BarChart2}
                label={t('analytics.bookings')}
                value={weekly.reservas ?? '—'}
                hint={pistaVariacao(varReservas)}
                tone={tomVariacao(varReservas)}
              />
              <MareStat icon={Users} label={t('analytics.newCustomers')} value={weekly.novos_clientes ?? '—'} />
              <MareStat icon={Star} label={t('analytics.avgRating')} value={ratingNum > 0 ? ratingNum.toFixed(1) : '—'} />
            </div>
          </div>

          {/* Origem de clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-4`}>{t('analytics.customerOrigin')}</h3>
              {origins.length === 0 ? (
                <EmptyState icon={Globe} title={t('analytics.noOriginData')} />
              ) : (
                <div className="space-y-2.5">
                  {origins.slice(0, 8).map((o, i) => (
                    <div key={o.country_code} className="flex items-center gap-3">
                      <span className={`text-xs ${NUM} font-semibold text-n-600 w-6 shrink-0`}>{o.country_code}</span>
                      <div className="flex-1 min-w-0 h-2 bg-n-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${o.pct}%`, backgroundColor: corDaOrigem(i) }}
                        />
                      </div>
                      <span className="text-xs font-body text-n-600 w-20 text-right shrink-0 truncate">
                        {nomePais(o.country_code, t)}
                      </span>
                      <span className={`text-xs ${NUM} text-n-600 w-12 text-right shrink-0`}>
                        {o.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={CARTAO}>
              <h3 className={`${TITULO} mb-4`}>{t('analytics.countryDistribution')}</h3>
              {origins.length === 0 ? (
                <EmptyState icon={BarChart2} title={t('analytics.noDataAvailable')} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={origins.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                    {/* barras horizontais: as linhas guia ficam no eixo dos valores */}
                    <CartesianGrid stroke="var(--n200)" horizontal={false} />
                    <XAxis type="number" tick={TICK_GRAFICO} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="country_code" width={34} tick={TICK_GRAFICO} tickLine={false} axisLine={false} />
                    <Tooltip content={<DicaOrigem />} cursor={{ fill: 'var(--ocean-50)' }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {origins.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={corDaOrigem(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          {/* Funil de conversao */}
          <section className={CARTAO}>
            <h3 className={`${TITULO} mb-5`}>{t('analytics.funnelTitle')}</h3>
            {!funnel ? (
              <EmptyState
                icon={Activity}
                title={t('analytics.funnelUnavailable')}
                description={<>{t('analytics.funnelHintA')}<span className="font-mono">/marketing/stats</span>{t('analytics.funnelHintB')}<span className="font-mono">funnel</span>{t('analytics.funnelHintC')}</>}
              />
            ) : (
              <div className="space-y-3 max-w-2xl">
                {[
                  { label: t('analytics.funnelSteps.pageViews'),        key: 'page_views',          color: 'var(--ocean-500)' },
                  { label: t('analytics.funnelSteps.bookingStarted'),   key: 'booking_started',     color: 'var(--ocean-500)' },
                  { label: t('analytics.funnelSteps.bookingCompleted'), key: 'booking_completed',   color: 'var(--ocean-500)' },
                  { label: t('analytics.funnelSteps.paymentConfirmed'), key: 'payment_confirmed',   color: 'var(--sand-500)' },
                ].map((step, i, arr) => {
                  const value = funnel[step.key] || 0;
                  const max   = funnel[arr[0].key] || 1;
                  const prev  = i > 0 ? (funnel[arr[i - 1].key] || 0) : null;
                  const pct   = prev != null && prev > 0 ? (value / prev) * 100 : null;
                  return (
                    <FunnelRow
                      key={step.key}
                      label={step.label}
                      value={value}
                      max={max}
                      color={step.color}
                      pct={pct}
                    />
                  );
                })}
                <p className="text-xs font-body text-n-500 pt-1">{t('analytics.funnelNote')}</p>
              </div>
            )}
          </section>

          {/* Relatorio semanal */}
          <section className={CARTAO}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className={`${TITULO} mb-1`}>{t('analytics.weeklyReport')}</h3>
                <p className="text-xs font-body text-n-500">
                  {t('analytics.weeklyReportDescription')}
                </p>
              </div>
              <Button
                icon={Mail}
                variant="secondary"
                size="sm"
                className="min-h-11 md:min-h-0"
                onClick={() => {
                  const subject = encodeURIComponent(t('analytics.email.subject'));
                  const body = encodeURIComponent(
                    `${t('analytics.email.healthScore', { v: score ?? '—' })}\n` +
                    `${t('analytics.email.revenue', { v: weekly.revenue != null ? fmtMoney(weekly.revenue) : '—' })}\n` +
                    `${t('analytics.email.bookings', { v: weekly.reservas ?? '—' })}\n` +
                    `${t('analytics.email.avgRating', { v: ratingNum > 0 ? ratingNum.toFixed(1) : '—' })}\n\n` +
                    t('analytics.email.generated', { date: formatarData(new Date()) }),
                  );
                  window.open(`mailto:?subject=${subject}&body=${body}`);
                }}
              >
                {t('analytics.sendEmail')}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
              <MareStat
                label={t('analytics.healthScoreShort')}
                value={score != null ? `${score}/100` : '—'}
                tone={score >= 70 ? 'bom' : 'aviso'}
              />
              <MareStat label={t('analytics.revenue')} value={weekly.revenue != null ? fmtMoney(weekly.revenue) : '—'} />
              <MareStat label={t('analytics.bookings')} value={weekly.reservas != null ? String(weekly.reservas) : '—'} />
              <MareStat label={t('analytics.rating')} value={ratingNum > 0 ? `${ratingNum.toFixed(1)} / 5.0` : '—'} />
            </div>
          </section>

          {/* ── Taxa de Abandono ── */}
          <section className={CARTAO}>
            <h3 className={`${TITULO} mb-4`}>{t('analytics.abandonmentTitle')}</h3>
            {(() => {
              const views    = mktg?.profile_views || stats?.profile_views || 0;
              const bookings = resumo?.atual?.num_reservas || 0;
              const abandonment = views > 0 ? Math.round(((views - bookings) / views) * 100) : null;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
                    <MareStat label={t('analytics.profileVisits')} value={views > 0 ? formatarNumero(views) : '—'} />
                    <MareStat label={t('analytics.completedBookings')} value={bookings > 0 ? String(bookings) : '—'} />
                    <MareStat
                      label={t('analytics.abandonmentRate')}
                      value={abandonment != null ? `${abandonment}%` : '—'}
                      tone={abandonment == null ? 'default' : abandonment > 60 ? 'aviso' : 'bom'}
                    />
                  </div>

                  {abandonment != null && abandonment > 70 && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--warning-light)] border border-[var(--warning)] rounded-[14px]">
                      <MousePointerClick size={14} strokeWidth={1.75} className="text-[var(--warning)] shrink-0 mt-0.5" />
                      <p className="text-xs font-body text-[var(--warning)]">
                        <span className="font-semibold">{t('analytics.highAbandonment', { n: abandonment })}</span>{' '}
                        {t('analytics.highAbandonmentTip')}
                      </p>
                    </div>
                  )}

                  {maisReservados.length > 0 && (
                    <div>
                      <p className="text-[13px] font-body font-semibold text-n-600 mb-2">{t('analytics.byTour')}</p>
                      <div className="space-y-2">
                        {maisReservados.map((u) => {
                          const popularity = maxReservas > 0 ? Math.round((Number(u.num_reservas || 0) / maxReservas) * 100) : 0;
                          const needsAttention = maxReservas > 0 && popularity < 50;
                          return (
                            <div key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-xs font-body text-n-700 w-28 sm:w-40 truncate shrink-0">{u.name}</span>
                              <div className="flex-1 min-w-[60px] h-2 bg-n-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${popularity}%`, backgroundColor: needsAttention ? 'var(--sand-500)' : 'var(--ocean-500)' }} />
                              </div>
                              <span className={`text-xs ${NUM} font-semibold w-10 text-right shrink-0 text-n-800`}>
                                {popularity}%
                              </span>
                              {needsAttention && (
                                <span className="text-xs font-body text-n-700 shrink-0">{t('analytics.improvePhotos')}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs font-body text-n-500 mt-2">
                        {t('analytics.byTourNote')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* ── Analise de Concorrencia ── */}
          <section className={CARTAO}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className={TITULO}>{t('analytics.competitionTitle')}</h3>
                <p className="text-xs font-body text-n-500 mt-0.5">
                  {t('analytics.competitionDescription')}
                </p>
              </div>
              <Building2 size={16} strokeWidth={1.75} className="text-n-500 shrink-0" aria-hidden="true" />
            </div>

            {units.length === 0 ? (
              <EmptyState icon={Building2} title={t('analytics.noTours')} />
            ) : (
              <Table columns={compColumns} rows={units.slice(0, 8)} compact />
            )}
            <p className="text-xs font-body text-n-500 mt-3">
              {t('analytics.competitionNote')}
            </p>
          </section>

        </div>
      )}
    </div>
  );
}
