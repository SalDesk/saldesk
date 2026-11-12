import { useState, useEffect } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Activity, TrendingUp, TrendingDown, Star,
  Users, Globe, BarChart2, RefreshCw, Mail,
  ArrowUpRight, ArrowDownRight, Minus,
  MousePointerClick, Building2, Edit2, Save, Check,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAnalyticsStats, getReviewsStats, getMarketingStats } from '../services/analyticsService';
import { listCustomers } from '../services/customersService';
import { getResumo, getUnidades } from '../services/financeiroService';
import { listUnits } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/shared/LoadingSpinner';

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
  return `€${Math.round(Number(v || 0)).toLocaleString('pt-PT')}`;
}

const COUNTRY_NAMES = {
  DE: 'Alemanha', GB: 'Reino Unido', NL: 'Holanda', FR: 'Franca',
  PT: 'Portugal', CV: 'Cabo Verde', US: 'EUA', ES: 'Espanha',
  IT: 'Italia', BE: 'Belgica', AT: 'Austria', CH: 'Suica',
  IE: 'Irlanda', PL: 'Polonia', BR: 'Brasil',
};

const CHART_COLORS = [
  'var(--ocean-700)', 'var(--ocean-500)', 'var(--ocean-400)', 'var(--ocean-300)',
  'var(--sand-500)', 'var(--sand-300)', 'var(--ocean-200)', 'var(--ocean-100)',
];

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
  if (score == null) {
    return (
      <div className="w-40 h-40 flex items-center justify-center rounded-full border-[12px] border-n-200 mx-auto">
        <span className="text-xs font-body text-n-400">Sem dados</span>
      </div>
    );
  }

  const r     = 60;
  const circ  = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color  = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--sand-500)' : 'var(--error)';
  const label  = score >= 70 ? 'Bom' : score >= 50 ? 'Moderado' : 'Critico';

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
        <span className="text-xs font-mono font-semibold text-n-800">{value}<span className="text-n-400">/{max}</span></span>
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
      <div className="w-36 shrink-0">
        <p className="text-xs font-body text-n-600 truncate">{label}</p>
      </div>
      <div className="flex-1 h-6 bg-n-100 rounded-sm overflow-hidden relative">
        <div
          className="h-full rounded-sm transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width: `${barPct}%`, backgroundColor: color, minWidth: barPct > 0 ? '2rem' : 0 }}
        >
          {barPct > 12 && (
            <span className="text-white text-xs font-mono font-semibold">{value.toLocaleString()}</span>
          )}
        </div>
        {barPct <= 12 && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-n-700">{value.toLocaleString()}</span>
        )}
      </div>
      {pct != null && (
        <span className="w-12 text-right text-xs font-mono text-n-500 shrink-0">{pct.toFixed(1)}%</span>
      )}
    </div>
  );
}

/* ── WeeklyMetric ── */
function WeeklyMetric({ label, value, delta, icon: Icon }) {
  const up      = delta > 0;
  const neutral = delta == null || delta === 0;
  const DIcon   = neutral ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const dColor  = neutral ? 'text-n-400' : up ? 'text-[var(--success)]' : 'text-[var(--error)]';
  return (
    <Card padding="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
          <Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-lg text-n-900 leading-none">{value}</p>
          <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        </div>
        {delta != null && (
          <span className={`flex items-center gap-0.5 text-xs font-body ${dColor}`}>
            <DIcon size={12} strokeWidth={2} />
            {!neutral && `${up ? '+' : ''}${delta}%`}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ── Posicao do preco face ao concorrente (limiares 5 e 20) ── */
function competitionPosition(ownPrice, compPrice) {
  if (!(ownPrice > 0 && compPrice > 0)) return { position: null, label: '—', color: 'text-n-400' };
  const diff = ((ownPrice - compPrice) / compPrice) * 100;
  if (diff > 20)  return { position: 'high',   label: `+${Math.round(diff)}% acima`, color: 'text-[var(--error)]' };
  if (diff > 5)   return { position: 'slight', label: `+${Math.round(diff)}% acima`, color: 'text-[var(--warning)]' };
  if (diff < -20) return { position: 'low',    label: `${Math.round(diff)}% abaixo`,  color: 'text-[var(--success)]' };
  if (diff < -5)  return { position: 'slight', label: `${Math.round(diff)}% abaixo`,  color: 'text-ocean-700' };
  return { position: null, label: 'Na media', color: 'text-[var(--success)]' };
}

/* ── Main Analytics ── */
export default function Analytics() {
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
    { label: 'Crescimento de receita', value: components.crescimento ?? 0, max: 25, color: 'var(--ocean-700)' },
    { label: 'Taxa de ocupacao',       value: components.ocupacao    ?? 0, max: 25, color: 'var(--ocean-500)' },
    { label: 'Avaliacoes',             value: components.avaliacoes  ?? 0, max: 25, color: 'var(--sand-500)' },
    { label: 'Fidelizacao',            value: components.fidelizacao ?? 0, max: 25, color: 'var(--ocean-400)' },
  ];

  /* Concorrencia: o preco do concorrente edita-se na propria celula */
  function guardarPreco(u, c) {
    const updated = { ...comp, [u.id]: { ...c, price: Number(compDraft[u.id] || 0) } };
    setComp(updated); saveComp(updated);
    setEditComp(null); setCompDraft({});
  }

  const compColumns = [
    {
      key: 'name', label: 'Tour',
      render: u => <span className="block max-w-[160px] truncate font-body font-semibold text-n-800">{u.name}</span>,
    },
    {
      key: 'own', label: 'Preco SalDesk',
      render: u => (
        <span className="font-display font-bold text-ocean-700">
          {Number(u.base_price || 0) > 0 ? `€${Number(u.base_price || 0)}` : '—'}
        </span>
      ),
    },
    {
      key: 'comp', label: 'Preco Viator/GYG',
      render: u => {
        const c = comp[u.id] || {};
        const compPrice = Number(c.price || 0);
        if (editComp === u.id) {
          return (
            <div className="w-28">
              <Input
                type="number" min="0" step="1"
                aria-label="Preco do concorrente"
                value={compDraft[u.id] ?? c.price ?? ''}
                onChange={e => setCompDraft(p => ({ ...p, [u.id]: e.target.value }))}
                className="font-mono"
                placeholder="Ex: 45"
                autoFocus
              />
            </div>
          );
        }
        return (
          <span className="font-mono text-n-700">
            {compPrice > 0 ? `€${compPrice}` : <span className="text-n-300 text-xs">Nao definido</span>}
          </span>
        );
      },
    },
    {
      key: 'position', label: 'Posicao no mercado',
      render: u => {
        const c = comp[u.id] || {};
        const pos = competitionPosition(Number(u.base_price || 0), Number(c.price || 0));
        return (
          <>
            <span className={`text-xs font-mono font-semibold ${pos.color}`}>{pos.label}</span>
            {pos.position === 'high' && (
              <p className="text-[10px] font-body text-n-400">Considera reduzir para aumentar conversao</p>
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
          <button
            aria-label="Guardar preco"
            onClick={() => guardarPreco(u, c)}
            className="p-1.5 rounded text-[var(--success)] hover:bg-[var(--success-light)] transition-colors"
          >
            <Check size={13} strokeWidth={2} />
          </button>
        ) : (
          <button
            aria-label="Editar preco"
            onClick={() => { setEditComp(u.id); setCompDraft(p => ({ ...p, [u.id]: c.price || '' })); }}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"
          >
            <Edit2 size={13} strokeWidth={1.75} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Visao estrategica do negocio"
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" onClick={carregar} loading={loading}>
            Actualizar
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : (
        <div className="space-y-5">

          {/* Score de Saude + componentes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card padding="px-6 py-6">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-5">Score de Saude do Negocio</h3>
              <HealthGauge score={score} />
              {score == null && (
                <p className="text-center text-xs font-body text-n-400 mt-3">
                  Configure o endpoint <span className="font-mono">/financial/stats</span> para activar.
                </p>
              )}
            </Card>

            <Card className="lg:col-span-2" padding="px-6 py-6">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-5">Componentes do Score</h3>
              <div className="space-y-4">
                {SCORE_COMPONENTS.map(c => (
                  <ScoreBar key={c.label} label={c.label} value={c.value} max={c.max} color={c.color} />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-n-100">
                <p className="text-xs font-body text-n-400">
                  Score baseado em crescimento de receita, ocupacao, avaliacoes e fidelizacao nos ultimos 30 dias.
                  {resumo == null && ' Carregue dados financeiros para score preciso.'}
                </p>
              </div>
            </Card>
          </div>

          {/* Resumo semanal */}
          <div>
            <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Resumo — Ultimos 30 dias</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <WeeklyMetric
                label="Receita"
                value={weekly.revenue != null ? fmtMoney(weekly.revenue) : '—'}
                delta={resumo?.variacao?.receita != null ? Math.round(resumo.variacao.receita) : null}
                icon={TrendingUp}
              />
              <WeeklyMetric
                label="Reservas"
                value={weekly.reservas ?? '—'}
                delta={resumo?.variacao?.num_reservas != null ? Math.round(resumo.variacao.num_reservas) : null}
                icon={BarChart2}
              />
              <WeeklyMetric
                label="Novos clientes"
                value={weekly.novos_clientes ?? '—'}
                icon={Users}
              />
              <WeeklyMetric
                label="Rating medio"
                value={ratingNum > 0 ? ratingNum.toFixed(1) : '—'}
                icon={Star}
              />
            </div>
          </div>

          {/* Origem de clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card padding="px-6 py-5">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Origem de Clientes</h3>
              {origins.length === 0 ? (
                <EmptyState icon={Globe} title="Sem dados de origem disponíveis." />
              ) : (
                <div className="space-y-2.5">
                  {origins.slice(0, 8).map((o, i) => (
                    <div key={o.country_code} className="flex items-center gap-3">
                      <span className="text-xs font-mono font-semibold text-n-500 w-6 shrink-0">{o.country_code}</span>
                      <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${o.pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                      </div>
                      <span className="text-xs font-body text-n-600 w-20 text-right shrink-0">
                        {COUNTRY_NAMES[o.country_code] || o.country_code}
                      </span>
                      <span className="text-xs font-mono text-n-500 w-10 text-right shrink-0">
                        {o.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="px-6 py-5">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Distribuicao por Pais</h3>
              {origins.length === 0 ? (
                <EmptyState icon={BarChart2} title="Sem dados disponiveis." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={origins.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="country_code" width={28} tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--n500)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--ocean-50)' }}
                      contentStyle={{ fontSize: 11, fontFamily: 'DM Sans', border: '1px solid var(--n200)', borderRadius: 4 }}
                      formatter={(v, _n, p) => [`${v} clientes (${p.payload.pct.toFixed(1)}%)`, p.payload.country_code]}
                    />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {origins.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Funil de conversao */}
          <Card padding="px-6 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-5">Funil de Conversao</h3>
            {!funnel ? (
              <EmptyState
                icon={Activity}
                title="Dados do funil nao disponiveis."
                description={<>Implemente <span className="font-mono">/marketing/stats</span> com campo <span className="font-mono">funnel</span>.</>}
              />
            ) : (
              <div className="space-y-3 max-w-2xl">
                {[
                  { label: 'Visitas pagina publica', key: 'page_views',          color: 'var(--ocean-700)' },
                  { label: 'Reserva iniciada',       key: 'booking_started',     color: 'var(--ocean-500)' },
                  { label: 'Reserva concluida',      key: 'booking_completed',   color: 'var(--ocean-400)' },
                  { label: 'Pagamento confirmado',   key: 'payment_confirmed',   color: 'var(--sand-500)' },
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
                <p className="text-xs font-body text-n-400 pt-1">% indica taxa de conversao para o passo anterior.</p>
              </div>
            )}
          </Card>

          {/* Relatorio semanal */}
          <Card padding="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-n-700 mb-1">Relatorio Semanal</h3>
                <p className="text-xs font-body text-n-400">
                  Envie um resumo por email com os principais indicadores dos ultimos 30 dias.
                </p>
              </div>
              <Button
                icon={Mail}
                variant="secondary"
                size="sm"
                onClick={() => {
                  const subject = encodeURIComponent('SalDesk — Relatorio Mensal');
                  const body = encodeURIComponent(
                    `Score de Saude: ${score ?? '—'}/100\n` +
                    `Receita: ${weekly.revenue != null ? fmtMoney(weekly.revenue) : '—'}\n` +
                    `Reservas: ${weekly.reservas ?? '—'}\n` +
                    `Rating medio: ${ratingNum > 0 ? ratingNum.toFixed(1) : '—'}\n\n` +
                    `Gerado em SalDesk — ${new Date().toLocaleDateString('pt-PT')}`,
                  );
                  window.open(`mailto:?subject=${subject}&body=${body}`);
                }}
              >
                Enviar por email
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Score de saude',  value: score != null ? `${score}/100` : '—',                       color: score >= 70 ? 'text-[var(--success)]' : score >= 50 ? 'text-[var(--warning)]' : 'text-[var(--error)]' },
                { label: 'Receita',         value: weekly.revenue  != null ? fmtMoney(weekly.revenue) : '—',   color: 'text-ocean-700' },
                { label: 'Reservas',        value: weekly.reservas != null ? String(weekly.reservas) : '—',    color: 'text-n-900' },
                { label: 'Rating',          value: ratingNum > 0 ? `${ratingNum.toFixed(1)} / 5.0` : '—',       color: 'text-sand-500' },
              ].map(m => (
                <div key={m.label} className="bg-n-50 rounded-sm px-4 py-3 border border-n-200">
                  <p className={`font-display font-bold text-lg leading-none ${m.color}`}>{m.value}</p>
                  <p className="text-xs font-body text-n-500 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Taxa de Abandono ── */}
          <Card padding="px-6 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Taxa de Abandono</h3>
            {(() => {
              const views    = mktg?.profile_views || stats?.profile_views || 0;
              const bookings = resumo?.atual?.num_reservas || 0;
              const abandonment = views > 0 ? Math.round(((views - bookings) / views) * 100) : null;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Visitas ao perfil',   value: views     > 0 ? views.toLocaleString('pt-PT')    : '—', color: 'text-n-900'    },
                      { label: 'Reservas completadas', value: bookings > 0 ? String(bookings)                 : '—', color: 'text-ocean-700' },
                      {
                        label: 'Taxa de abandono',
                        value: abandonment != null ? `${abandonment}%` : '—',
                        color: abandonment == null ? 'text-n-400' : abandonment > 80 ? 'text-[var(--error)]' : abandonment > 60 ? 'text-[var(--warning)]' : 'text-[var(--success)]',
                      },
                    ].map(m => (
                      <div key={m.label} className="bg-n-50 rounded-sm px-4 py-3 border border-n-200">
                        <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                        <p className="text-xs font-body text-n-500 mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {abandonment != null && abandonment > 70 && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm">
                      <MousePointerClick size={14} strokeWidth={1.75} className="text-[var(--warning)] shrink-0 mt-0.5" />
                      <p className="text-xs font-body text-[var(--warning)]">
                        <span className="font-semibold">Alta taxa de abandono ({abandonment}%).</span>{' '}
                        Muitos visitantes nao completam a reserva. Verifica as fotos e descricoes dos tours, simplifica o processo de reserva, ou considera reduzir o preco de entrada.
                      </p>
                    </div>
                  )}

                  {maisReservados.length > 0 && (
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">Por tour (reservas dos ultimos 30 dias)</p>
                      <div className="space-y-2">
                        {maisReservados.map((u) => {
                          const popularity = maxReservas > 0 ? Math.round((Number(u.num_reservas || 0) / maxReservas) * 100) : 0;
                          const needsAttention = maxReservas > 0 && popularity < 50;
                          return (
                            <div key={u.id} className="flex items-center gap-3">
                              <span className="text-xs font-body text-n-700 w-40 truncate shrink-0">{u.name}</span>
                              <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${popularity}%`, backgroundColor: needsAttention ? 'var(--error)' : 'var(--ocean-700)' }} />
                              </div>
                              <span className={`text-xs font-mono font-semibold w-10 text-right shrink-0 ${needsAttention ? 'text-[var(--error)]' : 'text-ocean-700'}`}>
                                {popularity}%
                              </span>
                              {needsAttention && (
                                <span className="text-[10px] font-body text-[var(--error)] shrink-0">melhora fotos</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] font-mono text-n-400 mt-2">
                        Percentagem das reservas do tour mais reservado nos ultimos 30 dias (canceladas nao contam).
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>

          {/* ── Analise de Concorrencia ── */}
          <Card padding="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-n-700">Analise de Concorrencia</h3>
                <p className="text-xs font-body text-n-400 mt-0.5">
                  Comparativo dos seus precos vs mercado (dados introduzidos manualmente)
                </p>
              </div>
              <Building2 size={16} strokeWidth={1.75} className="text-n-400 shrink-0" />
            </div>

            {units.length === 0 ? (
              <EmptyState icon={Building2} title="Sem tours registados para comparar." />
            ) : (
              <Table columns={compColumns} rows={units.slice(0, 8)} compact />
            )}
            <p className="text-[10px] font-mono text-n-400 mt-3">
              Introduz o preco do concorrente mais proximo (Viator, GYG ou operador local) para ver o comparativo. Guardado localmente.
            </p>
          </Card>

        </div>
      )}
    </div>
  );
}
