import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, TrendingUp, TrendingDown, Users, UserX,
  Globe, AlertTriangle, Mail, FileText, ArrowRight,
  ChevronUp, ChevronDown, RefreshCw, Printer,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

/* ─── Design constants ──────────────────────────────────────── */
const ICON        = { strokeWidth: 1.75, size: 20 };
const ICON_SM     = { strokeWidth: 1.75, size: 16 };
const PIE_COLORS  = ['#0D5470', '#1480A8', '#3A9BBF', '#D4A82A'];
const AXIS_TICK   = { fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' };
const TOOLTIP_CSS = { fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' };

const PLAN_BADGE  = { starter: 'bg-ocean-50 text-ocean-700', business: 'bg-sand-50 text-sand-500', pro: 'bg-n-100 text-n-700' };
const PLAN_LABEL  = { starter: 'Starter', business: 'Business', pro: 'Pro' };
const TYPE_LABEL  = { hotel: 'Hotel', activity: 'Actividade', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

const COUNTRY_NAMES = {
  PT: 'Portugal',  DE: 'Alemanha',    NL: 'Holanda',      GB: 'Reino Unido',
  FR: 'Franca',    IT: 'Italia',      ES: 'Espanha',      BE: 'Belgica',
  US: 'EUA',       BR: 'Brasil',      CV: 'Cabo Verde',   AT: 'Austria',
  CH: 'Suica',     SE: 'Suecia',      DK: 'Dinamarca',    NO: 'Noruega',
  PL: 'Polonia',   IE: 'Irlanda',     FI: 'Finlandia',    CZ: 'Rep. Checa',
};
function countryName(code) { return COUNTRY_NAMES[code] || code; }

/* ─── Shared components ─────────────────────────────────────── */
const TAB_BASE   = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap';
const TAB_ACTIVE = `${TAB_BASE} border-ocean-700 text-ocean-700`;
const TAB_IDLE   = `${TAB_BASE} border-transparent text-n-500 hover:text-n-900`;

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0 border-b border-n-200 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.key} className={active === t.key ? TAB_ACTIVE : TAB_IDLE} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, up, down }) {
  const subColor = up ? 'text-[var(--success)]' : down ? 'text-[var(--error)]' : 'text-n-400';
  return (
    <div className="bg-white rounded-md border border-n-200 px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon {...ICON} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-n-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-n-900 font-display leading-tight mt-0.5">{value ?? '—'}</p>
        {sub && <p className={`text-xs mt-0.5 font-medium ${subColor}`}>{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-n-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-n-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Tab 1: Tráfego ────────────────────────────────────────── */
function TrafficTab({ data }) {
  if (!data) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;

  const { days = [], pages = [], sources = [] } = data;
  const totalVisits = days.reduce((s, d) => s + d.visits, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={BarChart2} label="Visitas (30 dias)" value={totalVisits.toLocaleString('pt-PT')} sub="dados simulados — GA em breve" />
        <KpiCard icon={Users} label="Paginas mais visitadas" value={pages[0]?.label || '—'} sub={`${pages[0]?.visits?.toLocaleString('pt-PT') || 0} visitas`} />
        <KpiCard icon={Globe} label="Principal origem" value={sources[0]?.name || '—'} sub={`${sources[0]?.value || 0}% do trafego`} />
      </div>

      <SectionCard title="Visitas por dia — últimos 30 dias">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={days} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" />
            <XAxis dataKey="label" tick={AXIS_TICK} interval={4} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_CSS} />
            <Bar dataKey="visits" name="Visitas" fill="#1480A8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Páginas mais visitadas">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-100">
                <th className="text-left text-xs font-medium text-n-500 pb-2 pr-3">Página</th>
                <th className="text-right text-xs font-medium text-n-500 pb-2 pr-3">Visitas</th>
                <th className="text-right text-xs font-medium text-n-500 pb-2">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p, i) => (
                <tr key={p.path} className="border-b border-n-50 last:border-0">
                  <td className="py-2 pr-3">
                    <span className="font-mono text-xs text-n-400 mr-2">{i + 1}</span>
                    <span className="text-n-900">{p.label}</span>
                    <span className="text-xs text-n-400 ml-1 hidden sm:inline">{p.path}</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-medium text-n-900">{p.visits.toLocaleString('pt-PT')}</td>
                  <td className="py-2 text-right text-n-500">{p.avg_time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Origem do tráfego">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} ${value}%`} labelLine>
                {sources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_CSS} formatter={(v) => `${v}%`} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans' }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

/* ─── Tab 2: Funil ──────────────────────────────────────────── */
function FunnelStep({ label, value, prevValue, pctNext, width, isLast }) {
  const delta = value - prevValue;
  const DeltaIcon = delta >= 0 ? ChevronUp : ChevronDown;
  const deltaColor = delta >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex items-center justify-between px-5 py-3 bg-ocean-700 text-white rounded-md transition-all"
        style={{ width: `${width}%` }}
      >
        <span className="text-sm font-medium truncate">{label}</span>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-lg font-bold font-display">{value.toLocaleString('pt-PT')}</span>
          <span className={`flex items-center text-xs font-medium ${deltaColor} bg-white/20 rounded px-1`}>
            <DeltaIcon size={12} strokeWidth={2} />
            {Math.abs(delta)}
          </span>
        </div>
      </div>
      {!isLast && pctNext != null && (
        <div className="flex items-center gap-1 text-xs text-n-500 my-0.5">
          <ArrowRight size={12} strokeWidth={1.75} />
          <span className="font-medium text-ocean-700">{pctNext}%</span>
          <span>taxa de conversao</span>
        </div>
      )}
    </div>
  );
}

function FunnelTab({ data }) {
  if (!data) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;

  const { current = [], previous = [] } = data;
  const widths = [100, 80, 62, 46];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {current.map((step, i) => {
          const prev = previous[i]?.value || 0;
          const delta = step.value - prev;
          return (
            <div key={step.label} className="bg-white rounded-md border border-n-200 p-4">
              <p className="text-xs font-medium text-n-500 uppercase tracking-wide truncate">{step.label}</p>
              <p className="text-2xl font-bold text-n-900 font-display mt-1">{step.value.toLocaleString('pt-PT')}</p>
              <p className={`text-xs font-medium mt-1 flex items-center gap-0.5 ${delta >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {delta >= 0 ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                {Math.abs(delta)} vs mes anterior
              </p>
            </div>
          );
        })}
      </div>

      <SectionCard title="Funil de conversão">
        <div className="flex flex-col items-center gap-0 py-4 space-y-1">
          {current.map((step, i) => (
            <FunnelStep
              key={step.label}
              label={step.label}
              value={step.value}
              prevValue={previous[i]?.value || 0}
              pctNext={step.pct_next}
              width={widths[i]}
              isLast={i === current.length - 1}
            />
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-n-100 grid grid-cols-3 gap-4 text-center">
          {current.slice(0, 3).map((step, i) => (
            <div key={i}>
              <p className="text-xs text-n-500">{step.label} → {current[i + 1]?.label}</p>
              <p className="text-xl font-bold text-ocean-700 font-display mt-0.5">{step.pct_next ?? 0}%</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── Tab 3: Churn ──────────────────────────────────────────── */
function ChurnTab({ data }) {
  if (!data) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;

  const { churn_rate = 0, cancelled_this_month = 0, cancelled_list = [], at_risk = [], ltv_by_plan = [] } = data;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-PT') : '—';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={TrendingDown}
          label="Churn mensal"
          value={`${churn_rate}%`}
          sub={churn_rate > 5 ? 'Acima do limite saudavel (5%)' : 'Dentro do limite saudavel'}
          down={churn_rate > 5}
          up={churn_rate <= 2}
        />
        <KpiCard icon={UserX} label="Cancelamentos este mes" value={cancelled_this_month} sub={`${cancelled_list.length} total acumulado`} down={cancelled_this_month > 0} />
        <KpiCard icon={AlertTriangle} label="Operadores em risco" value={at_risk.length} sub="Inactivos +14 dias ou trial a expirar" down={at_risk.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="LTV por plano">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ltv_by_plan} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" />
              <XAxis dataKey="plan" tick={AXIS_TICK} tickFormatter={p => PLAN_LABEL[p] || p} />
              <YAxis tick={AXIS_TICK} tickFormatter={v => `€${v}`} />
              <Tooltip contentStyle={TOOLTIP_CSS} formatter={(v, n) => [n === 'ltv' ? `€${v}` : v, n === 'ltv' ? 'LTV' : 'Operadores']} />
              <Bar dataKey="ltv" name="ltv" fill="#0D5470" radius={[3, 3, 0, 0]} />
              <Bar dataKey="count" name="count" fill="#D4A82A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {ltv_by_plan.map(p => (
              <div key={p.plan} className="text-center p-2 rounded-lg bg-n-50">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_BADGE[p.plan]}`}>{PLAN_LABEL[p.plan]}</span>
                <p className="text-lg font-bold text-n-900 font-display mt-1">€{p.ltv}</p>
                <p className="text-xs text-n-400">~{p.avg_months}m · {p.count} ops</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={`Operadores em risco (${at_risk.length})`}>
          {at_risk.length === 0 && <p className="text-sm text-n-400 text-center py-8">Nenhum operador em risco</p>}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {at_risk.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-n-50 border border-n-100">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-n-900 truncate">{o.name}</p>
                  <p className="text-xs text-n-400">{TYPE_LABEL[o.operator_type] || o.operator_type} · {PLAN_LABEL[o.plan] || o.plan}</p>
                </div>
                <div className="text-right shrink-0">
                  {o.plan_status === 'trial' && o.trial_ends_at && (
                    <span className="text-xs font-medium text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded-full">
                      Trial expira {fmtDate(o.trial_ends_at)}
                    </span>
                  )}
                  {o.plan_status !== 'trial' && (
                    <span className="text-xs text-n-400">Inactivo desde {fmtDate(o.last_active)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title={`Operadores cancelados (${cancelled_list.length})`}>
        {cancelled_list.length === 0 && <p className="text-sm text-n-400 text-center py-6">Nenhum cancelamento registado</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-100">
                {['Nome', 'Email', 'Plano', 'Tipo', 'Cancelado em'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-n-500 pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cancelled_list.map(o => (
                <tr key={o.id} className="border-b border-n-50 last:border-0">
                  <td className="py-2 pr-4 font-medium text-n-900">{o.name}</td>
                  <td className="py-2 pr-4 text-n-500 text-xs">{o.email}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_BADGE[o.plan]}`}>{PLAN_LABEL[o.plan] || o.plan}</span>
                  </td>
                  <td className="py-2 pr-4 text-n-500">{TYPE_LABEL[o.operator_type] || o.operator_type}</td>
                  <td className="py-2 text-n-400">{fmtDate(o.cancelled_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── Tab 4: Geografia ──────────────────────────────────────── */
function GeographyTab({ data }) {
  if (!data) return <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>;

  const { top10 = [], total = 0 } = data;
  const chartData = top10.map(r => ({ ...r, name: countryName(r.country) }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Globe} label="Total de clientes" value={total.toLocaleString('pt-PT')} sub="em toda a plataforma" />
        <KpiCard icon={Users} label="Principal mercado" value={countryName(top10[0]?.country || '')} sub={`${top10[0]?.pct || 0}% dos clientes`} />
        <KpiCard icon={TrendingUp} label="Paises representados" value={top10.length} sub="top 10 listados" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Top 10 — países de origem dos turistas">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={58} />
              <Tooltip contentStyle={TOOLTIP_CSS} formatter={(v) => [v, 'Clientes']} />
              <Bar dataKey="visits" name="Clientes" fill="#1480A8" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Ranking de nacionalidades">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-100">
                <th className="text-left text-xs font-medium text-n-500 pb-2 pr-3">#</th>
                <th className="text-left text-xs font-medium text-n-500 pb-2 pr-3">Pais</th>
                <th className="text-right text-xs font-medium text-n-500 pb-2 pr-3">Clientes</th>
                <th className="text-right text-xs font-medium text-n-500 pb-2">Quota</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r, i) => (
                <tr key={r.country} className="border-b border-n-50 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs text-n-400">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-n-900">{countryName(r.country)}</span>
                    <span className="text-xs text-n-400 ml-1.5">{r.country}</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-medium text-n-900">{r.visits.toLocaleString('pt-PT')}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-n-100 rounded-full overflow-hidden">
                        <div className="h-full bg-ocean-700 rounded-full" style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-n-700 w-8 text-right">{r.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}

/* ─── Tab 5: Relatório mensal ────────────────────────────────── */
function ReportTab({ funnel, churn }) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg]         = useState('');

  const now       = new Date();
  const MONTH_PT  = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const monthName = `${MONTH_PT[now.getMonth()]} ${now.getFullYear()}`;

  const current  = funnel?.current  || [];
  const leads    = current[0]?.value ?? '—';
  const registos = current[1]?.value ?? '—';
  const activos  = current[2]?.value ?? '—';
  const pagantes = current[3]?.value ?? '—';

  const churnRate   = churn?.churn_rate ?? '—';
  const cancelados  = churn?.cancelled_this_month ?? '—';
  const emRisco     = churn?.at_risk?.length ?? '—';
  const ltvBusiness = churn?.ltv_by_plan?.find(p => p.plan === 'business')?.ltv ?? '—';

  const sendReport = async () => {
    setSending(true); setMsg('');
    try {
      const { data } = await api.post('/admin/analytics/send-report');
      setMsg(data.message || 'Relatorio enviado');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro ao enviar relatorio');
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-n-900">Resumo de {monthName}</h3>
          <p className="text-xs text-n-400 mt-0.5">Gerado automaticamente a partir dos dados da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-n-200 text-sm text-n-700 hover:bg-n-50 transition-colors print:hidden"
            onClick={() => window.print()}
          >
            <Printer {...ICON_SM} />
            Exportar PDF
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-700 text-white text-sm font-medium hover:bg-ocean-900 transition-colors disabled:opacity-50 print:hidden"
            onClick={sendReport}
            disabled={sending}
          >
            <Mail {...ICON_SM} />
            {sending ? 'A enviar...' : 'Enviar por email'}
          </button>
        </div>
      </div>

      {msg && (
        <p className={`text-sm font-medium ${msg.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>{msg}</p>
      )}

      <div id="report-content" className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KpiCard icon={Users}       label="Leads / Visitantes"   value={leads}    />
          <KpiCard icon={TrendingUp}  label="Operadores registados" value={registos} />
          <KpiCard icon={BarChart2}   label="Operadores activos"    value={activos}  />
          <KpiCard icon={TrendingUp}  label="Operadores pagantes"   value={pagantes} />
          <KpiCard icon={TrendingDown} label="Churn mensal"         value={`${churnRate}%`} down={churnRate > 5} />
          <KpiCard icon={AlertTriangle} label="Em risco"            value={emRisco}  down={emRisco > 0} />
        </div>

        <SectionCard title="Funil do mes">
          <div className="grid grid-cols-4 gap-3">
            {current.map((step, i) => (
              <div key={step.label} className="text-center p-4 bg-n-50 rounded-lg">
                <p className="text-xs font-medium text-n-500 uppercase tracking-wide">{step.label}</p>
                <p className="text-3xl font-bold text-ocean-700 font-display mt-1">{step.value.toLocaleString('pt-PT')}</p>
                {step.pct_next != null && (
                  <p className="text-xs text-n-400 mt-1">{step.pct_next}% converte</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="LTV e retenção">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(churn?.ltv_by_plan || []).map(p => (
              <div key={p.plan} className="p-4 rounded-lg bg-n-50 border border-n-100">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_BADGE[p.plan]}`}>{PLAN_LABEL[p.plan]}</span>
                <p className="text-2xl font-bold text-n-900 font-display mt-2">€{p.ltv}</p>
                <p className="text-xs text-n-500 mt-0.5">LTV medio · {p.avg_months} meses · {p.count} operadores</p>
                <p className="text-xs text-n-400 mt-0.5">€{p.price}/mes</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="p-4 rounded-lg bg-ocean-50 border border-ocean-100 print:border print:border-n-200">
          <p className="text-xs font-semibold text-ocean-700 uppercase tracking-wide mb-2">Notas do mes</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-n-500">Cancelamentos: </span><span className="font-medium text-n-900">{cancelados}</span></div>
            <div><span className="text-n-500">Em risco: </span><span className="font-medium text-n-900">{emRisco}</span></div>
            <div><span className="text-n-500">LTV Business: </span><span className="font-medium text-n-900">€{ltvBusiness}</span></div>
            <div><span className="text-n-500">Taxa churn: </span><span className="font-medium text-n-900">{churnRate}%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
const TABS = [
  { key: 'traffic',  label: 'Trafego'     },
  { key: 'funnel',   label: 'Funil'       },
  { key: 'churn',    label: 'Churn'       },
  { key: 'geo',      label: 'Geografia'   },
  { key: 'report',   label: 'Relatorio'   },
];

export default function AdminAnalytics() {
  const [tab,     setTab]     = useState('traffic');
  const [traffic, setTraffic] = useState(null);
  const [funnel,  setFunnel]  = useState(null);
  const [churn,   setChurn]   = useState(null);
  const [geo,     setGeo]     = useState(null);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f, c, g] = await Promise.all([
        api.get('/admin/analytics/traffic'),
        api.get('/admin/analytics/funnel'),
        api.get('/admin/analytics/churn'),
        api.get('/admin/analytics/geography'),
      ]);
      setTraffic(t.data.data);
      setFunnel(f.data.data);
      setChurn(c.data.data);
      setGeo(g.data.data);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="space-y-6 print:p-8">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-n-900 font-display">Analytics</h1>
          <p className="text-sm text-n-500 mt-1">Trafego, funil de conversao, churn e geografia da plataforma</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-n-200 text-sm text-n-700 hover:bg-n-50 transition-colors"
          onClick={loadAll}
          disabled={loading}
        >
          <RefreshCw {...ICON_SM} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-n-200 overflow-hidden print:border-0">
        <div className="px-4 pt-4 print:hidden">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
        </div>
        <div className="p-4 print:p-0">
          {tab === 'traffic' && <TrafficTab data={traffic} />}
          {tab === 'funnel'  && <FunnelTab  data={funnel}  />}
          {tab === 'churn'   && <ChurnTab   data={churn}   />}
          {tab === 'geo'     && <GeographyTab data={geo}   />}
          {tab === 'report'  && <ReportTab  funnel={funnel} churn={churn} />}
        </div>
      </div>
    </div>
  );
}
