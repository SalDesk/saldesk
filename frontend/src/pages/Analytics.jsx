import { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Star,
  Users, Globe, BarChart2, RefreshCw, Mail,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAnalyticsStats, getReviewsStats, getMarketingStats } from '../services/analyticsService';
import { listCustomers } from '../services/customersService';
import { getResumo } from '../services/financeiroService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── helpers ── */
function ultimos30() {
  const fim    = new Date();
  const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
  const fmt = d => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(fim) };
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
  '#0D5470', '#1480A8', '#3BA7CB', '#6DC4E0',
  '#D4A82A', '#EAD08A', '#9BCFE0', '#B0D9E8',
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

  const rating = Number(reviewsStats?.average_rating);
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
  const color  = score >= 70 ? '#1A7A4A' : score >= 50 ? '#D4A82A' : '#B91C1C';
  const label  = score >= 70 ? 'Bom' : score >= 50 ? 'Moderado' : 'Critico';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 160 160" className="w-40 h-40">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#E5E8EC" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="78" textAnchor="middle" fill="#1A2332"
          style={{ fontSize: '30px', fontWeight: '700', fontFamily: 'Sora' }}>
          {score}
        </text>
        <text x="80" y="98" textAnchor="middle" fill="#6B7280"
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
function ScoreBar({ label, value, max = 25, color = '#0D5470' }) {
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
  const dColor  = neutral ? 'text-n-400' : up ? 'text-[#1A7A4A]' : 'text-error';
  return (
    <div className="bg-white rounded-md border border-n-200 px-4 py-3 flex items-center gap-3">
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
  );
}

/* ── Main Analytics ── */
export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [resumo,  setResumo]  = useState(null);
  const [reviews, setReviews] = useState(null);
  const [stats,   setStats]   = useState(null);
  const [mktg,    setMktg]    = useState(null);
  const [origins, setOrigins] = useState([]);

  const carregar = async () => {
    setLoading(true);
    try {
      const p = ultimos30();
      const [r, rv, st, mk, customers] = await Promise.all([
        getResumo(p.inicio, p.fim).catch(() => null),
        getReviewsStats().catch(() => null),
        getAnalyticsStats().catch(() => null),
        getMarketingStats().catch(() => null),
        listCustomers({}).catch(() => []),
      ]);
      setResumo(r);
      setReviews(rv);
      setStats(st);
      setMktg(mk);

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

  const weekly = stats?.weekly_summary || {
    revenue:       resumo?.atual?.receita       || null,
    reservas:      resumo?.atual?.num_reservas  || null,
    novos_clientes: null,
    rating_medio:  reviews?.average_rating      || null,
  };

  const ratingNum = Number(reviews?.average_rating || 0);

  const SCORE_COMPONENTS = [
    { label: 'Crescimento de receita', value: components.crescimento ?? 0, max: 25, color: '#0D5470' },
    { label: 'Taxa de ocupacao',       value: components.ocupacao    ?? 0, max: 25, color: '#1480A8' },
    { label: 'Avaliacoes',             value: components.avaliacoes  ?? 0, max: 25, color: '#D4A82A' },
    { label: 'Fidelizacao',            value: components.fidelizacao ?? 0, max: 25, color: '#3BA7CB' },
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
                <div className="text-center py-8">
                  <Globe size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
                  <p className="text-sm font-body text-n-400">Sem dados de origem disponíveis.</p>
                </div>
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
                <div className="text-center py-8">
                  <BarChart2 size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
                  <p className="text-sm font-body text-n-400">Sem dados disponiveis.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={origins.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#6B7280' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="country_code" width={28} tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#6B7280' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#EBF7FB' }}
                      contentStyle={{ fontSize: 11, fontFamily: 'DM Sans', border: '1px solid #E5E8EC', borderRadius: 4 }}
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
              <div className="text-center py-8">
                <Activity size={28} strokeWidth={1.25} className="mx-auto mb-2 text-n-300" />
                <p className="text-sm font-body text-n-400">Dados do funil nao disponiveis.</p>
                <p className="text-xs font-body text-n-400 mt-1">
                  Implemente <span className="font-mono">/marketing/stats</span> com campo <span className="font-mono">funnel</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {[
                  { label: 'Visitas pagina publica', key: 'page_views',          color: '#0D5470' },
                  { label: 'Reserva iniciada',       key: 'booking_started',     color: '#1480A8' },
                  { label: 'Reserva concluida',      key: 'booking_completed',   color: '#3BA7CB' },
                  { label: 'Pagamento confirmado',   key: 'payment_confirmed',   color: '#D4A82A' },
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
                { label: 'Score de saude',  value: score != null ? `${score}/100` : '—',                       color: score >= 70 ? 'text-[#1A7A4A]' : score >= 50 ? 'text-yellow-700' : 'text-error' },
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

        </div>
      )}
    </div>
  );
}
