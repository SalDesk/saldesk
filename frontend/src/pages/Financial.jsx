import { useState, useEffect, useCallback } from 'react';
import {
  Euro, BarChart2, TrendingUp,
  FileSpreadsheet, FileText, ArrowUpRight, ArrowDownRight,
  Minus, Receipt, RefreshCw, Wallet, Edit2,
  CalendarDays, AlertTriangle, Layers,
} from 'lucide-react';
import {
  getResumo, getReceita, getUnidades, getTopClientes,
  getCanais, exportExcel, getTransacoes, exportPdf,
  getForecast,
} from '../services/financeiroService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import KpiCard from '../components/financial/KpiCard';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import TopCustomersList from '../components/financial/TopCustomersList';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── constants ── */
const EUR_CVE = 110;
const TOUR_COSTS_KEY = 'saldesk_tour_costs_v1';

const FINANCIAL_TABS = [
  { key: 'geral',    label: 'Visao Geral', Icon: BarChart2 },
  { key: 'portour',  label: 'Por Tour',    Icon: Layers },
  { key: 'previsao', label: 'Previsao',    Icon: TrendingUp },
  { key: 'caixa',    label: 'Caixa',       Icon: Wallet },
];

const PRESETS = [
  { label: 'Ultimos 30 dias', fn: ultimos30 },
  { label: 'Este mes',        fn: mesAtual },
  { label: 'Mes anterior',    fn: mesAnterior },
  { label: 'Este ano',        fn: esteAno },
];
const GRANULARIDADES = [
  { value: 'day',   label: 'Dia' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

const PAYMENT_METHODS = ['Todos', 'paypal', 'sisp', 'cash', 'transfer'];
const PAYMENT_STATUS  = ['Todos', 'paid', 'pending', 'partial', 'refunded'];
const PM_LABEL  = { paypal: 'PayPal', sisp: 'SISP', cash: 'Dinheiro', transfer: 'Transferencia' };
const PS_LABEL  = { paid: 'Pago', pending: 'Pendente', partial: 'Parcial', refunded: 'Reembolsado' };
const PS_COLOR  = { paid: 'text-green-700 bg-green-50', pending: 'text-yellow-700 bg-yellow-50', partial: 'text-blue-700 bg-blue-50', refunded: 'text-n-500 bg-n-100' };
const SRC_LABEL = { direct: 'Directa', public: 'Directa', manual: 'Manual', booking_com: 'Booking', airbnb: 'Airbnb', viator: 'Viator', getyourguide: 'GYG' };

const COST_FIELDS = [
  { key: 'guide',     label: 'Guia / Instrutor' },
  { key: 'transport', label: 'Transporte' },
  { key: 'tickets',   label: 'Bilhetes / Entrada' },
  { key: 'meals',     label: 'Refeicoes' },
  { key: 'other',     label: 'Outros' },
];

/* ── helpers ── */
function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}
function mesAnterior() {
  const n = new Date(), mo = n.getMonth() === 0 ? 11 : n.getMonth() - 1;
  const y  = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
  const ms = String(mo + 1).padStart(2, '0');
  return { inicio: `${y}-${ms}-01`, fim: `${y}-${ms}-${new Date(y, mo + 1, 0).getDate()}` };
}
function esteAno() {
  const y = new Date().getFullYear();
  return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
}
function ultimos30() {
  const fim   = new Date();
  const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
  const fmt = d => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fim: fmt(fim) };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}
function fmtMoney(v, currency) {
  const n = Number(v || 0);
  if (currency === 'CVE') return `${Math.round(n * EUR_CVE).toLocaleString('pt-PT')} CVE`;
  return `€${Math.round(n).toLocaleString('pt-PT')}`;
}

function loadCosts() {
  try { return JSON.parse(localStorage.getItem(TOUR_COSTS_KEY) || '{}'); }
  catch { return {}; }
}
function saveCosts(c) { localStorage.setItem(TOUR_COSTS_KEY, JSON.stringify(c)); }

function unitTotalCost(c) {
  if (!c) return 0;
  return COST_FIELDS.reduce((s, f) => s + Number(c[f.key] || 0), 0);
}

/* ── CostEditModal ── */
function CostEditModal({ open, onClose, unitId, unitName, costs, onSave }) {
  const [fields, setFields] = useState({ guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 });

  useEffect(() => {
    if (open) setFields(costs || { guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 });
  }, [open, costs]);

  const total = COST_FIELDS.reduce((s, f) => s + Number(fields[f.key] || 0), 0);

  return (
    <Modal open={open} onClose={onClose} title={`Custos — ${unitName}`} size="sm">
      <div className="space-y-3">
        {COST_FIELDS.map(f => (
          <div key={f.key} className="flex items-center gap-3">
            <label className="text-xs font-body text-n-600 w-36 shrink-0">{f.label}</label>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs font-mono text-n-400">€</span>
              <input
                type="number" min="0" step="0.01"
                value={fields[f.key]}
                onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                className="flex-1 h-8 px-2 text-sm font-mono border border-n-200 rounded focus:outline-none focus:border-ocean-700"
              />
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-n-100 flex items-center justify-between">
          <span className="text-xs font-body text-n-500">Total custo operacional</span>
          <span className="font-display font-bold text-n-800">€{total.toFixed(2)}</span>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => { onSave(unitId, fields); onClose(); }} className="flex-1">Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── TransacoesTable ── */
function TransacoesTable({ transacoes, currency, loading }) {
  const [filterMethod, setFilterMethod] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [search, setSearch] = useState('');

  const rows = (transacoes || []).filter(t => {
    if (filterMethod !== 'Todos' && t.payment_method !== filterMethod) return false;
    if (filterStatus !== 'Todos' && t.payment_status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${t.customers?.first_name || ''} ${t.customers?.last_name || ''}`.toLowerCase();
      if (!name.includes(q) && !(t.units?.name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar cliente ou servico..."
          className="h-8 px-3 text-sm font-body border border-n-200 rounded bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 w-52" />
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
          className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white text-n-700 focus:outline-none">
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m === 'Todos' ? 'Todos os metodos' : PM_LABEL[m] || m}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white text-n-700 focus:outline-none">
          {PAYMENT_STATUS.map(s => <option key={s} value={s}>{s === 'Todos' ? 'Todos os estados' : PS_LABEL[s] || s}</option>)}
        </select>
        <span className="text-xs font-body text-n-400 ml-1">{rows.length} transacao(oes)</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-n-400">
          <Receipt size={28} strokeWidth={1.25} className="mx-auto mb-2" />
          <p className="text-sm font-body">Sem transacoes no periodo</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-200">
                {['Data', 'Cliente', 'Servico', 'Canal', 'Metodo', 'Montante', 'Estado'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map(t => (
                <tr key={t.id} className="border-b border-n-100 hover:bg-n-50 transition-colors">
                  <td className="py-2.5 px-3 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</td>
                  <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">{t.customers?.first_name} {t.customers?.last_name}</td>
                  <td className="py-2.5 px-3 font-body text-n-700 max-w-[140px] truncate">{t.units?.name || '—'}</td>
                  <td className="py-2.5 px-3"><span className="text-xs font-mono text-n-500">{SRC_LABEL[t.source] || t.source || '—'}</span></td>
                  <td className="py-2.5 px-3"><span className="text-xs font-body text-n-600">{PM_LABEL[t.payment_method] || t.payment_method || '—'}</span></td>
                  <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_amount, currency)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>
                      {PS_LABEL[t.payment_status] || t.payment_status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <p className="text-xs font-body text-n-400 text-center pt-3">A mostrar 50 de {rows.length} resultados</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Comparativo ── */
function Comparativo({ resumo, currency }) {
  if (!resumo?.variacao || !resumo?.atual || !resumo?.anterior) return null;
  const { atual, anterior, variacao } = resumo;

  const rows = [
    { label: 'Receita',  atual: atual.receita,       ant: anterior.receita,       fmt: 'euro', delta: variacao.receita },
    { label: 'Reservas', atual: atual.num_reservas,  ant: anterior.num_reservas,  fmt: 'num',  delta: variacao.num_reservas },
    { label: 'Ocupacao', atual: atual.taxa_ocupacao, ant: anterior.taxa_ocupacao, fmt: 'pct',  delta: variacao.taxa_ocupacao },
  ];

  function fmt(v, f) {
    if (f === 'euro') return fmtMoney(v, currency);
    if (f === 'pct')  return `${Number(v || 0).toFixed(1)}%`;
    return String(v ?? 0);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-n-200">
            {['Metrica', 'Periodo actual', 'Periodo anterior', 'Variacao'].map(h => (
              <th key={h} className={`py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 ${h === 'Metrica' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const up = r.delta > 0, neutral = r.delta === 0 || r.delta == null;
            const Icon = neutral ? Minus : up ? ArrowUpRight : ArrowDownRight;
            const color = neutral ? 'text-n-400' : up ? 'text-green-600' : 'text-error';
            return (
              <tr key={r.label} className="border-b border-n-100">
                <td className="py-2.5 px-3 font-body font-semibold text-n-800">{r.label}</td>
                <td className="py-2.5 px-3 text-right font-display font-bold text-ocean-700">{fmt(r.atual, r.fmt)}</td>
                <td className="py-2.5 px-3 text-right font-body text-n-500">{fmt(r.ant, r.fmt)}</td>
                <td className="py-2.5 px-3 text-right">
                  <span className={`flex items-center justify-end gap-1 text-xs font-body ${color}`}>
                    <Icon size={12} strokeWidth={2} />
                    {neutral ? '—' : `${up ? '+' : ''}${r.fmt === 'pct' ? `${Number(r.delta).toFixed(1)} p.p.` : r.fmt === 'euro' ? fmtMoney(r.delta, currency) : r.delta}`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── PorTourTab ── */
function PorTourTab({ unidades, currency, costs, onEditCosts }) {
  if (!unidades || unidades.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <Layers size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
          <p className="font-body text-n-500">Sem dados de tours no periodo seleccionado.</p>
        </div>
      </Card>
    );
  }

  const rows = unidades.map(u => {
    const custo = unitTotalCost(costs[u.unit_id || u.id]);
    const receita = Number(u.receita || u.total_revenue || 0);
    const margem = receita - custo;
    const margemPct = receita > 0 ? (margem / receita) * 100 : null;
    return { ...u, custo, receita, margem, margemPct };
  });

  const maxPct = Math.max(...rows.map(r => r.margemPct ?? -Infinity));
  const minPct = Math.min(...rows.map(r => r.margemPct ?? Infinity));

  return (
    <div className="space-y-4">
      <Card
        header={<h3 className="font-display font-semibold text-sm text-n-700">Receita por tour</h3>}
        padding="px-5 pb-5 pt-2"
      >
        <ServiceBarChart data={unidades} currency={currency} />
      </Card>

      <Card header={
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-n-700">Custos operacionais por tour</h3>
          <span className="text-xs font-body text-n-400">Custos guardados localmente</span>
        </div>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-n-200">
                {['Tour / Servico', 'Reservas', 'Receita bruta', 'Custo operacional', 'Margem', '%'].map(h => (
                  <th key={h} className={`py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 ${h === 'Tour / Servico' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
                <th className="py-2 px-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isBest  = r.margemPct != null && r.margemPct === maxPct && maxPct > -Infinity;
                const isWorst = r.margemPct != null && r.margemPct === minPct && minPct < Infinity && minPct !== maxPct;
                const rowCls = isBest ? 'bg-[#ECFDF5]' : isWorst ? 'bg-red-50' : '';
                return (
                  <tr key={r.unit_id || r.id} className={`border-b border-n-100 ${rowCls}`}>
                    <td className="py-2.5 px-3 font-body font-semibold text-n-800 max-w-[180px] truncate">
                      {r.unit_name || r.name || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-n-600">{r.num_reservas ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right font-display font-bold text-ocean-700">{fmtMoney(r.receita, currency)}</td>
                    <td className="py-2.5 px-3 text-right font-body text-n-700">{r.custo > 0 ? fmtMoney(r.custo, currency) : <span className="text-n-400 text-xs">Nao definido</span>}</td>
                    <td className={`py-2.5 px-3 text-right font-display font-bold ${r.margem >= 0 ? 'text-[#1A7A4A]' : 'text-error'}`}>
                      {r.custo > 0 ? fmtMoney(r.margem, currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {r.margemPct != null && r.custo > 0 ? (
                        <span className={`text-xs font-mono font-semibold ${r.margemPct >= 0 ? 'text-[#1A7A4A]' : 'text-error'}`}>
                          {r.margemPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-n-400 text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => onEditCosts(r.unit_id || r.id, r.unit_name || r.name)}
                        className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"
                      >
                        <Edit2 size={13} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── PrevisaoTab ── */
function PrevisaoTab({ forecast, currency, loading }) {
  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  }

  if (!forecast) {
    return (
      <Card>
        <div className="text-center py-12">
          <TrendingUp size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
          <p className="font-body text-n-500">Dados de previsao nao disponiveis.</p>
          <p className="text-xs font-body text-n-400 mt-1">Implemente o endpoint <span className="font-mono">GET /financial/forecast</span> no backend.</p>
        </div>
      </Card>
    );
  }

  const { confirmed_future_revenue, same_period_last_year, historical_avg, weeks } = forecast;
  const isBelow = historical_avg > 0 && confirmed_future_revenue < historical_avg * 0.8;

  return (
    <div className="space-y-4">
      {isBelow && (
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertTriangle size={16} strokeWidth={1.75} className="text-yellow-600 shrink-0" />
          <p className="text-sm font-body text-yellow-700">
            Previsao abaixo da media historica. Considere acoes de marketing para aumentar reservas.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard label="Receita confirmada (proximos 30 dias)" value={confirmed_future_revenue} format="euro" currency={currency} icon={CalendarDays} />
        <KpiCard label="Mesmo periodo — ano anterior" value={same_period_last_year} format="euro" currency={currency} icon={TrendingUp} />
        <KpiCard label="Media historica mensal" value={historical_avg} format="euro" currency={currency} icon={BarChart2} />
      </div>

      {weeks?.length > 0 && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Previsao semanal</h3>}>
          <div className="space-y-0">
            {weeks.map((w, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-n-100 last:border-0">
                <span className="text-xs font-mono text-n-500">{w.week_label || w.week}</span>
                <div className="flex items-center gap-6">
                  <span className="text-xs font-body text-n-500">{w.num_reservas} reserva(s)</span>
                  <span className="font-display font-bold text-ocean-700 text-sm">{fmtMoney(w.receita, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── CaixaTab ── */
function CaixaTab({ transacoes, currency, loading }) {
  const cash     = (transacoes || []).filter(t => t.payment_method === 'cash');
  const totalRec = cash.reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const pago     = cash.filter(t => t.payment_status === 'paid').reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const pendente = cash.filter(t => t.payment_status === 'pending').reduce((s, t) => s + Number(t.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total recebido em caixa', value: fmtMoney(totalRec, currency), cls: 'text-n-900' },
          { label: 'Confirmado',              value: fmtMoney(pago, currency),     cls: 'text-[#1A7A4A]' },
          { label: 'Por confirmar',           value: fmtMoney(pendente, currency), cls: 'text-yellow-700' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4">
            <p className={`font-display font-bold text-xl ${m.cls}`}>{m.value}</p>
            <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
      ) : cash.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Wallet size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
            <p className="font-body text-n-500">Sem pagamentos em dinheiro no periodo seleccionado.</p>
          </div>
        </Card>
      ) : (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Pagamentos em dinheiro</h3>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200">
                  {['Data', 'Cliente', 'Servico', 'Montante', 'Estado'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cash.map(t => (
                  <tr key={t.id} className="border-b border-n-100 hover:bg-n-50 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</td>
                    <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">{t.customers?.first_name} {t.customers?.last_name}</td>
                    <td className="py-2.5 px-3 font-body text-n-700 max-w-[160px] truncate">{t.units?.name || '—'}</td>
                    <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_amount, currency)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>
                        {PS_LABEL[t.payment_status] || t.payment_status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Main ── */
export default function Financial() {
  useT();
  const [periodo,       setPeriodo]      = useState(ultimos30);
  const [presetAtivo,   setPresetAtivo]  = useState(0);
  const [granularidade, setGran]         = useState('day');
  const [currency,      setCurrency]     = useState('EUR');
  const [exporting,     setExporting]    = useState('');
  const [activeTab,     setActiveTab]    = useState('geral');

  const [resumo,     setResumo]     = useState(null);
  const [receita,    setReceita]    = useState([]);
  const [sazonal,    setSazonal]    = useState([]);
  const [unidades,   setUnidades]   = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [canais,     setCanais]     = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingTx,  setLoadingTx]  = useState(false);

  const [forecast,        setForecast]        = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastLoaded,  setForecastLoaded]  = useState(false);

  const [costs,        setCosts]        = useState(loadCosts);
  const [editingUnit,  setEditingUnit]  = useState(null);

  const carregar = useCallback(async (p, gran) => {
    setLoading(true);
    try {
      const [r, rec, un, cli, can] = await Promise.all([
        getResumo(p.inicio, p.fim),
        getReceita(p.inicio, p.fim, gran),
        getUnidades(p.inicio, p.fim),
        getTopClientes(p.inicio, p.fim),
        getCanais(p.inicio, p.fim),
      ]);
      setResumo(r); setReceita(rec); setUnidades(un); setClientes(cli); setCanais(can);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const carregarTx = useCallback(async (p) => {
    setLoadingTx(true);
    try {
      const data = await getTransacoes(p.inicio, p.fim);
      setTransacoes(data || []);
    } catch { setTransacoes([]); }
    finally { setLoadingTx(false); }
  }, []);

  useEffect(() => { carregar(periodo, granularidade); carregarTx(periodo); }, [periodo, granularidade]);

  useEffect(() => {
    const y = new Date().getFullYear();
    getReceita(`${y}-01-01`, `${y}-12-31`, 'month')
      .then(d => setSazonal(d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'previsao' && !forecastLoaded) {
      setLoadingForecast(true);
      getForecast()
        .then(f => { setForecast(f); setForecastLoaded(true); })
        .catch(() => { setForecastLoaded(true); })
        .finally(() => setLoadingForecast(false));
    }
  }, [activeTab, forecastLoaded]);

  function selectPreset(i) {
    const p = PRESETS[i].fn();
    setPresetAtivo(i);
    setPeriodo(p);
  }

  async function handleExport(type) {
    setExporting(type);
    try {
      if (type === 'excel') await exportExcel(periodo.inicio, periodo.fim);
      else                  await exportPdf(periodo.inicio, periodo.fim);
    } finally { setExporting(''); }
  }

  function handleSaveCosts(unitId, fields) {
    const updated = { ...costs, [unitId]: fields };
    setCosts(updated);
    saveCosts(updated);
  }

  /* KPI derivados */
  const atual    = resumo?.atual || {};
  const variacao = resumo?.variacao || {};

  const directas = (canais || [])
    .filter(c => ['direct', 'public', 'manual'].includes(c.source))
    .reduce((s, c) => s + (c.num_reservas || 0), 0);
  const ota = (canais || [])
    .filter(c => !['direct', 'public', 'manual'].includes(c.source))
    .reduce((s, c) => s + (c.num_reservas || 0), 0);
  const totalBookings = directas + ota;
  const directaPct = totalBookings > 0 ? Math.round((directas / totalBookings) * 100) : null;

  const ticketMedio = atual.num_reservas > 0
    ? Number(atual.receita || 0) / atual.num_reservas
    : 0;

  const totalCustos = Object.values(costs).reduce((s, c) => s + unitTotalCost(c), 0);
  const receitaNum  = Number(atual.receita || 0);
  const margemLiq   = receitaNum > 0 ? receitaNum - totalCustos : null;
  const margemPct   = receitaNum > 0 && totalCustos > 0 ? ((receitaNum - totalCustos) / receitaNum) * 100 : null;

  const crescimento = variacao.receita != null && resumo?.anterior?.receita > 0
    ? ((receitaNum - Number(resumo.anterior.receita)) / Number(resumo.anterior.receita)) * 100
    : null;

  /* editing state */
  const editUnit = editingUnit
    ? (unidades.find(u => (u.unit_id || u.id) === editingUnit.id) || {})
    : null;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileSpreadsheet} size="sm"
              loading={exporting === 'excel'} onClick={() => handleExport('excel')}>
              Excel
            </Button>
            <Button variant="secondary" icon={FileText} size="sm"
              loading={exporting === 'pdf'} onClick={() => handleExport('pdf')}>
              PDF
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-0.5 bg-n-100 rounded-sm p-0.5">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => selectPreset(i)}
              className={`px-3 py-1.5 rounded-xs text-xs font-body font-semibold transition-colors whitespace-nowrap ${presetAtivo === i ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 bg-n-100 rounded-sm p-0.5">
          {GRANULARIDADES.map(g => (
            <button key={g.value} onClick={() => setGran(g.value)}
              className={`px-3 py-1.5 rounded-xs text-xs font-body font-semibold transition-colors ${granularidade === g.value ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 bg-n-100 rounded-sm p-0.5 ml-auto">
          {['EUR', 'CVE'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 rounded-xs text-xs font-mono font-semibold transition-colors ${currency === c ? 'bg-ocean-700 text-white shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-5">
        {FINANCIAL_TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-ocean-700 text-ocean-700'
                : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading && activeTab === 'geral' ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : activeTab === 'geral' ? (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Receita total"
              value={atual.receita}
              delta={variacao.receita}
              deltaLabel="vs periodo ant."
              icon={Euro}
              format="euro"
              currency={currency}
            />
            <KpiCard
              label={`Directas ${directaPct != null ? directaPct + '%' : ''}`}
              value={directas}
              sub={ota > 0 ? `${ota} via OTA` : undefined}
              icon={BarChart2}
              format="number"
            />
            <KpiCard
              label="Ticket medio"
              value={ticketMedio}
              icon={Receipt}
              format="euro"
              currency={currency}
            />
            <KpiCard
              label={`Margem liquida${margemPct != null ? ` (${margemPct.toFixed(0)}%)` : ''}`}
              value={margemLiq}
              delta={crescimento}
              deltaLabel="crescimento"
              icon={TrendingUp}
              format="euro"
              currency={currency}
            />
          </div>

          {/* Receita + Canal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card
              className="lg:col-span-2"
              header={
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-sm text-n-700">Receita por periodo</h3>
                  <span className="text-xs font-mono text-n-400">{periodo.inicio} — {periodo.fim}</span>
                </div>
              }
              padding="px-5 pb-5 pt-2"
            >
              <RevenueChart data={receita} granularidade={granularidade} currency={currency} />
            </Card>
            <Card
              header={<h3 className="font-display font-semibold text-sm text-n-700">Por canal</h3>}
              padding="px-5 pb-5 pt-2"
            >
              <ChannelChart data={canais} />
            </Card>
          </div>

          {/* Sazonalidade anual */}
          {sazonal.length > 0 && (
            <Card
              header={<h3 className="font-display font-semibold text-sm text-n-700">Sazonalidade anual — {new Date().getFullYear()}</h3>}
              padding="px-5 pb-5 pt-2"
            >
              <RevenueChart data={sazonal} granularidade="month" currency={currency} />
            </Card>
          )}

          {/* Top servicos + clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card
              header={<h3 className="font-display font-semibold text-sm text-n-700">Top 5 servicos por receita</h3>}
              padding="px-5 pb-5 pt-2"
            >
              <ServiceBarChart data={unidades} currency={currency} />
            </Card>
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Top clientes</h3>}>
              <TopCustomersList data={clientes} />
            </Card>
          </div>

          {/* Comparativo */}
          {resumo?.anterior && (
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Comparativo com periodo anterior</h3>}>
              <Comparativo resumo={resumo} currency={currency} />
            </Card>
          )}

          {/* Transacoes */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm text-n-700">Transacoes</h3>
                <button onClick={() => carregarTx(periodo)}
                  className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                  <RefreshCw size={13} strokeWidth={1.75} />
                </button>
              </div>
            }
          >
            <TransacoesTable transacoes={transacoes} currency={currency} loading={loadingTx} />
          </Card>
        </div>

      ) : activeTab === 'portour' ? (
        loading ? (
          <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
        ) : (
          <PorTourTab
            unidades={unidades}
            currency={currency}
            costs={costs}
            onEditCosts={(id, name) => setEditingUnit({ id, name })}
          />
        )

      ) : activeTab === 'previsao' ? (
        <PrevisaoTab forecast={forecast} currency={currency} loading={loadingForecast} />

      ) : activeTab === 'caixa' ? (
        <CaixaTab transacoes={transacoes} currency={currency} loading={loadingTx} />

      ) : null}

      {/* Cost edit modal */}
      {editingUnit && (
        <CostEditModal
          open={!!editingUnit}
          onClose={() => setEditingUnit(null)}
          unitId={editingUnit.id}
          unitName={editingUnit.name}
          costs={costs[editingUnit.id]}
          onSave={handleSaveCosts}
        />
      )}
    </div>
  );
}
