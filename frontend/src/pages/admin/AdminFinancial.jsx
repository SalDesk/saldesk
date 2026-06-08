import { useState, useEffect, useMemo } from 'react';
import {
  Euro, TrendingUp, Users, UserX, BarChart2, TrendingDown,
  Download, Save, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PIE_COLORS  = ['#1480A8', '#0D5470', '#D4A82A'];
const AXIS_TICK   = { fontSize: 11, fontFamily: 'DM Sans', fill: '#6B7280' };
const TOOLTIP_CSS = { fontFamily: 'DM Sans', fontSize: 12, borderRadius: 6, border: '1px solid #E5E8EC' };
const PLAN_BADGE  = { starter: 'info', business: 'pending', pro: 'confirmed' };

const COST_LABELS = {
  cost_hostinger:      'Hostinger VPS',
  cost_supabase:       'Supabase',
  cost_sendgrid:       'SendGrid',
  cost_domains_annual: 'Domínios (anual)',
  cost_outros:         'Outros',
};

function fmt(n) { return `€${Number(n || 0).toFixed(2)}`; }
function pct(n) { return `${n >= 0 ? '+' : ''}${n}%`; }

function KpiCard({ icon: Icon, label, value, sub, positive, negative }) {
  const subColor = positive ? 'text-[var(--success)]' : negative ? 'text-[var(--error)]' : 'text-n-400';
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-xl text-n-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{label}</p>
        {sub && <p className={`text-xs font-body font-semibold ${subColor}`}>{sub}</p>}
      </div>
    </div>
  );
}

function exportCsv(summary, mrrHistory, costs) {
  const monthlyFixed = (costs.cost_hostinger || 0) + (costs.cost_supabase || 0)
    + (costs.cost_sendgrid || 0) + (costs.cost_outros || 0)
    + Math.round((costs.cost_domains_annual || 0) / 12 * 100) / 100;

  const lines = [];
  lines.push('SalDesk — Relatorio Financeiro da Plataforma');
  lines.push(`Gerado em,${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('KPIs');
  lines.push(`MRR actual (EUR),${summary.mrr}`);
  lines.push(`Variacao MoM (%),${summary.mrr_change_pct}`);
  lines.push(`Operadores pagantes,${summary.paying_operators}`);
  lines.push(`Operadores em trial,${summary.trial_operators}`);
  lines.push(`Churn este mes,${summary.churn_this_month}`);
  lines.push(`LTV medio (EUR),${summary.ltv_avg}`);
  lines.push('');
  lines.push('Historico MRR — ultimos 12 meses');
  lines.push('Mes,MRR total (EUR),Starter,Business,Pro,Churn');
  mrrHistory.forEach(m => {
    lines.push(`${m.month},${m.mrr},${m.starter},${m.business},${m.pro},${m.churn}`);
  });
  lines.push('');
  lines.push('Custos mensais');
  lines.push('Fornecedor,Valor (EUR)');
  lines.push(`Hostinger VPS,${costs.cost_hostinger || 0}`);
  lines.push(`Supabase,${costs.cost_supabase || 0}`);
  lines.push(`SendGrid,${costs.cost_sendgrid || 0}`);
  lines.push(`Dominios (rateio mensal),${Math.round((costs.cost_domains_annual || 0) / 12 * 100) / 100}`);
  lines.push(`Outros,${costs.cost_outros || 0}`);
  lines.push(`TOTAL MENSAL,${monthlyFixed}`);
  lines.push('');
  lines.push('Previsao MRR proximos 3 meses');
  (summary.forecast || []).forEach(f => lines.push(`${f.label},${f.mrr}`));

  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `saldesk-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminFinancial() {
  const [summary,    setSummary]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [costs,      setCosts]      = useState({});
  const [costEdits,  setCostEdits]  = useState({});
  const [operators,  setOperators]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [costSaved,  setCostSaved]  = useState(false);
  const [exporting,  setExporting]  = useState(false);

  const [filterPlan,  setFilterPlan]  = useState('');
  const [filterFrom,  setFilterFrom]  = useState('');
  const [filterTo,    setFilterTo]    = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/admin/financial/summary'),
      api.get('/admin/financial/mrr-history'),
      api.get('/admin/financial/costs'),
      api.get('/admin/operators'),
    ]).then(([sumRes, histRes, costsRes, opsRes]) => {
      setSummary(sumRes.data.data);
      setHistory(histRes.data.data || []);
      const c = costsRes.data.data || {};
      setCosts(c);
      setCostEdits(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v)])));
      setOperators(opsRes.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const monthlyFixed = useMemo(() => {
    const c = Object.fromEntries(
      Object.entries(costEdits).map(([k, v]) => [k, Number(v) || 0])
    );
    return c.cost_hostinger + c.cost_supabase + c.cost_sendgrid + c.cost_outros
      + Math.round((c.cost_domains_annual / 12) * 100) / 100;
  }, [costEdits]);

  const mrr        = summary?.mrr || 0;
  const netResult  = Math.round((mrr - monthlyFixed) * 100) / 100;
  const marginPct  = mrr > 0 ? Math.round(((mrr - monthlyFixed) / mrr) * 1000) / 10 : 0;

  async function handleSaveCosts() {
    setSavingCosts(true); setCostSaved(false);
    try {
      const payload = Object.fromEntries(
        Object.entries(costEdits).map(([k, v]) => [k, Number(v) || 0])
      );
      await api.put('/admin/financial/costs', payload);
      setCosts(payload);
      setCostSaved(true);
    } catch {} finally { setSavingCosts(false); }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await api.get('/admin/financial/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `saldesk-financeiro-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {} finally { setExporting(false); }
  }

  const payingOps = useMemo(() => {
    let rows = operators.filter(o => o.plan_status === 'active' || o.plan_status === 'trial');
    if (filterPlan) rows = rows.filter(o => o.plan === filterPlan);
    if (filterFrom) rows = rows.filter(o => o.created_at && o.created_at.slice(0, 10) >= filterFrom);
    if (filterTo)   rows = rows.filter(o => o.created_at && o.created_at.slice(0, 10) <= filterTo);
    return [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [operators, filterPlan, filterFrom, filterTo]);

  const pieData = useMemo(() => {
    const last = history[history.length - 1];
    if (!last) return [];
    return [
      { name: 'Starter',  value: last.starter  || 0 },
      { name: 'Business', value: last.business || 0 },
      { name: 'Pro',      value: last.pro      || 0 },
    ].filter(d => d.value > 0);
  }, [history]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Financeiro da Plataforma" subtitle="Receitas, custos e metricas financeiras da SalDesk" />
        <div className="flex justify-center py-20"><LoadingSpinner /></div>
      </div>
    );
  }

  const mrrChange = summary?.mrr_change_pct ?? 0;
  const hasFilters = filterPlan || filterFrom || filterTo;

  return (
    <div>
      <PageHeader
        title="Financeiro da Plataforma"
        subtitle="Receitas, custos e metricas financeiras da SalDesk"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary" size="sm" icon={Download}
              onClick={() => exportCsv(summary || {}, history, costs)}
            >
              Exportar CSV
            </Button>
            <Button size="sm" icon={Download} loading={exporting} onClick={handleExportExcel}>
              Exportar Excel
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <KpiCard icon={Euro}       label="MRR actual"           value={fmt(mrr)} sub={`vs mês anterior: ${pct(mrrChange)}`} positive={mrrChange > 0} negative={mrrChange < 0} />
        <KpiCard icon={TrendingUp} label="Variação MoM"         value={pct(mrrChange)} positive={mrrChange > 0} negative={mrrChange < 0} />
        <KpiCard icon={Users}      label="Pagantes"             value={summary?.paying_operators ?? 0} sub={`${summary?.trial_operators ?? 0} em trial`} />
        <KpiCard icon={UserX}      label="Churn este mês"       value={summary?.churn_this_month ?? 0} negative={(summary?.churn_this_month ?? 0) > 0} />
        <KpiCard icon={BarChart2}  label="LTV médio"            value={fmt(summary?.ltv_avg)} />
        <KpiCard icon={TrendingUp} label="Previsão próx. mês"   value={fmt(summary?.forecast?.[0]?.mrr)} sub={summary?.forecast?.[0]?.label} />
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">MRR — últimos 12 meses</h3>} padding="px-5 pb-5 pt-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#D4A82A" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#D4A82A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={44} tickFormatter={v => `€${v}`} />
              <Tooltip formatter={v => [`€${v}`, 'MRR']} contentStyle={TOOLTIP_CSS} />
              <Area type="monotone" dataKey="mrr" stroke="#D4A82A" strokeWidth={2} fill="url(#mrrFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Operadores por plano ao longo do tempo</h3>} padding="px-5 pb-5 pt-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} tickFormatter={v => `€${v}`} />
              <Tooltip formatter={(v, n) => [`€${v}`, n]} contentStyle={TOOLTIP_CSS} />
              <Line type="monotone" dataKey="starter"  stroke="#1480A8" strokeWidth={2} dot={false} name="Starter" />
              <Line type="monotone" dataKey="business" stroke="#0D5470" strokeWidth={2} dot={false} name="Business" />
              <Line type="monotone" dataKey="pro"      stroke="#D4A82A" strokeWidth={2} dot={false} name="Pro" />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, fontFamily: 'DM Sans', color: '#374151' }}>{v}</span>} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Churn por mês</h3>} padding="px-5 pb-5 pt-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip formatter={v => [v, 'Cancelamentos']} contentStyle={TOOLTIP_CSS} />
              <Bar dataKey="churn" fill="#B91C1C" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Distribuição de receita por plano</h3>} padding="px-4 pb-4 pt-2">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="45%" innerRadius={48} outerRadius={72} paddingAngle={3}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`€${v}`, n]} contentStyle={TOOLTIP_CSS} />
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, fontFamily: 'DM Sans', color: '#374151' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-n-400 text-sm font-body">Sem dados de receita</div>
          )}
        </Card>
      </div>

      {/* Custos + P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2">
          <Card header={
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-n-700">Custos fixos mensais</h3>
              <div className="flex items-center gap-3">
                {costSaved && <span className="text-xs font-body text-[var(--success)]">Guardado.</span>}
                <Button size="sm" icon={Save} loading={savingCosts} onClick={handleSaveCosts}>Guardar custos</Button>
              </div>
            </div>
          }>
            <div className="space-y-3">
              {Object.entries(COST_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm font-body text-n-700 w-44 shrink-0">{label}</span>
                  <div className="flex items-center gap-1.5 flex-1 max-w-44">
                    <span className="text-sm font-body text-n-400">€</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={costEdits[key] ?? ''}
                      onChange={e => { setCostSaved(false); setCostEdits(prev => ({ ...prev, [key]: e.target.value })); }}
                      className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
                    />
                  </div>
                  {key === 'cost_domains_annual' && (
                    <span className="text-xs font-body text-n-400">→ €{Math.round(Number(costEdits[key] || 0) / 12 * 100) / 100}/mês</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">P&amp;L mensal</h3>}>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-n-100">
              <span className="text-sm font-body text-n-500">MRR (receita)</span>
              <span className="font-display font-bold text-base text-n-900">{fmt(mrr)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-n-100">
              <span className="text-sm font-body text-n-500">Total custos</span>
              <span className="font-display font-semibold text-base text-n-700">{fmt(monthlyFixed)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-n-100">
              <span className="text-sm font-body text-n-500">Margem</span>
              <span className={`font-display font-bold text-base ${marginPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {marginPct}%
              </span>
            </div>
            <div className="flex justify-between items-center py-3 bg-ocean-50 rounded-sm px-3 -mx-0">
              <span className="text-sm font-body font-bold text-n-700">Resultado líquido</span>
              <span className={`font-display font-bold text-lg ${netResult >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {fmt(netResult)}
              </span>
            </div>

            <div className="pt-1">
              <p className="text-xs font-body font-bold text-n-500 uppercase tracking-wide mb-2">Previsão MRR</p>
              {(summary?.forecast || []).map(f => (
                <div key={f.label} className="flex justify-between text-xs font-body py-1">
                  <span className="text-n-500">{f.label}</span>
                  <span className="font-semibold text-n-700">{fmt(f.mrr)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Historico de pagamentos */}
      <div className="mb-2">
        <h2 className="font-display font-bold text-lg text-n-900">Operadores pagantes</h2>
        <p className="text-sm font-body text-n-500">{payingOps.length} operador(es) correspondem aos filtros</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="w-36">
          <option value="">Todos os planos</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="pro">Pro</option>
        </Select>
        <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-40" />
        <Input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   className="w-40" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterPlan(''); setFilterFrom(''); setFilterTo(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Card padding="p-0">
        {payingOps.length === 0 ? (
          <p className="text-xs font-body text-n-400 px-5 py-6 text-center">Nenhum operador corresponde aos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="border-b border-n-200 bg-n-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-body font-bold text-n-500 uppercase tracking-wide">Operador</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold text-n-500 uppercase tracking-wide">Plano</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold text-n-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-body font-bold text-n-500 uppercase tracking-wide">Início</th>
                  <th className="text-right px-5 py-3 text-xs font-body font-bold text-n-500 uppercase tracking-wide">Valor/mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {payingOps.map(o => (
                  <tr key={o.id} className="hover:bg-n-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-n-900">{o.name}</p>
                      <p className="text-xs text-n-400">{o.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PLAN_BADGE[o.plan]}>{o.plan}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={o.plan_status === 'active' ? 'confirmed' : 'pending'}>{o.plan_status === 'active' ? 'Pago' : 'Trial'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-n-500 font-mono text-xs">{o.created_at?.slice(0, 10) || '—'}</td>
                    <td className="px-5 py-3 text-right font-display font-bold text-n-900">
                      {o.plan_status === 'active' ? fmt(summary?.price_map?.[o.plan] || 0) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
