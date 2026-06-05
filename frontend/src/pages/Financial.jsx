import { useState, useEffect, useCallback } from 'react';
import {
  Euro, BarChart2, TrendingUp, TrendingDown,
  FileSpreadsheet, FileText, ArrowUpRight, ArrowDownRight,
  Minus, Receipt, RefreshCw, Wallet, Edit2,
  CalendarDays, AlertTriangle, Layers, Plus, Trash2,
  Users, Percent, Calculator, Check, Save, Lock,
} from 'lucide-react';
import usePlan from '../hooks/usePlan';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  getResumo, getReceita, getUnidades, getTopClientes,
  getCanais, exportExcel, getTransacoes, exportPdf,
  getForecast,
} from '../services/financeiroService';
import {
  listExpenses, addExpenseLocal, updateExpenseLocal, deleteExpenseLocal,
  getSalaryConfig, setSalaryConfig as persistSalaryConfig, getSalaryPayments, addSalaryPayment, isMonthPaid,
  getObligations, setObligations,
} from '../services/expensesService';
import {
  listSellerCommissions, markCommissionPaid as markCommPaid, getSellerCommissionPct,
} from '../services/sellerService';
import { listStaff } from '../services/staffService';
import { useT } from '../i18n';
import PlanGuard from '../components/PlanGuard';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import KpiCard from '../components/financial/KpiCard';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import TopCustomersList from '../components/financial/TopCustomersList';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── constants ── */
const EUR_CVE = 110;
const TOUR_COSTS_KEY = 'saldesk_tour_costs_v1';

const SECTIONS = [
  { key: 'receitas',   label: 'Receitas',   Icon: TrendingUp,   pro: false },
  { key: 'despesas',   label: 'Despesas',   Icon: TrendingDown,  pro: true  },
  { key: 'salarios',   label: 'Salarios',   Icon: Users,         pro: true  },
  { key: 'comissoes',  label: 'Comissoes',  Icon: Percent,       pro: false },
  { key: 'obrigacoes', label: 'Obrigacoes', Icon: AlertTriangle,  pro: true  },
  { key: 'resultado',  label: 'Resultado',  Icon: Calculator,    pro: true  },
];

const RECEITAS_TABS = [
  { key: 'geral',    label: 'Visao Geral', Icon: BarChart2  },
  { key: 'portour',  label: 'Por Tour',    Icon: Layers     },
  { key: 'previsao', label: 'Previsao',    Icon: TrendingUp },
  { key: 'caixa',    label: 'Caixa',       Icon: Wallet     },
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

const EXPENSE_CATEGORIES = [
  'Salarios', 'Comissoes vendedores', 'Seguro viatura',
  'Manutencao', 'Combustivel', 'Renda', 'Electricidade',
  'Internet', 'Equipamento', 'Marketing', 'Subscricao SalDesk',
  'INPS', 'IUR', 'Outro',
];

const CAT_COLORS = [
  '#0D5470','#1480A8','#3BA7CB','#6DC4E0','#9BCFE0',
  '#D4A82A','#EAD08A','#1A7A4A','#B91C1C','#7C3AED',
  '#D97706','#374151','#6B7280','#9BA3AF',
];

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ── date helpers ── */
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
  const fim = new Date(); const inicio = new Date(); inicio.setDate(inicio.getDate() - 29);
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
  try { return JSON.parse(localStorage.getItem(TOUR_COSTS_KEY) || '{}'); } catch { return {}; }
}
function saveCosts(c) { localStorage.setItem(TOUR_COSTS_KEY, JSON.stringify(c)); }
function unitTotalCost(c) {
  if (!c) return 0;
  return COST_FIELDS.reduce((s, f) => s + Number(c[f.key] || 0), 0);
}

/* ─────────────────── RECEITAS TAB COMPONENTS ─────────────────── */

function CostEditModal({ open, onClose, unitId, unitName, costs, onSave }) {
  const [fields, setFields] = useState({ guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 });
  useEffect(() => { if (open) setFields(costs || { guide: 0, transport: 0, tickets: 0, meals: 0, other: 0 }); }, [open, costs]);
  const total = COST_FIELDS.reduce((s, f) => s + Number(fields[f.key] || 0), 0);
  return (
    <Modal open={open} onClose={onClose} title={`Custos — ${unitName}`} size="sm">
      <div className="space-y-3">
        {COST_FIELDS.map(f => (
          <div key={f.key} className="flex items-center gap-3">
            <label className="text-xs font-body text-n-600 w-36 shrink-0">{f.label}</label>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs font-mono text-n-400">€</span>
              <input type="number" min="0" step="0.01" value={fields[f.key]}
                onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                className="flex-1 h-8 px-2 text-sm font-mono border border-n-200 rounded focus:outline-none focus:border-ocean-700" />
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..."
          className="h-8 px-3 text-sm font-body border border-n-200 rounded bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 w-48" />
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
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       rows.length === 0 ? (
        <div className="text-center py-10 text-n-400">
          <Receipt size={28} strokeWidth={1.25} className="mx-auto mb-2" />
          <p className="text-sm font-body">Sem transacoes no periodo</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-n-200">
              {['Data','Cliente','Servico','Canal','Metodo','Montante','Estado'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>{rows.slice(0, 50).map(t => (
              <tr key={t.id} className="border-b border-n-100 hover:bg-n-50 transition-colors">
                <td className="py-2.5 px-3 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</td>
                <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">{t.customers?.first_name} {t.customers?.last_name}</td>
                <td className="py-2.5 px-3 font-body text-n-700 max-w-[140px] truncate">{t.units?.name || '—'}</td>
                <td className="py-2.5 px-3"><span className="text-xs font-mono text-n-500">{SRC_LABEL[t.source] || t.source || '—'}</span></td>
                <td className="py-2.5 px-3"><span className="text-xs font-body text-n-600">{PM_LABEL[t.payment_method] || t.payment_method || '—'}</span></td>
                <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_amount, currency)}</td>
                <td className="py-2.5 px-3"><span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>{PS_LABEL[t.payment_status] || t.payment_status || '—'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
        <thead><tr className="border-b border-n-200">
          {['Metrica','Periodo actual','Periodo anterior','Variacao'].map(h => (
            <th key={h} className={`py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 ${h === 'Metrica' ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{rows.map(r => {
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
        })}</tbody>
      </table>
    </div>
  );
}

function PorTourTab({ unidades, currency, costs, onEditCosts }) {
  if (!unidades || unidades.length === 0) return (
    <Card><div className="text-center py-12"><Layers size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Sem dados de tours no periodo.</p></div></Card>
  );
  const rows = unidades.map(u => {
    const custo = unitTotalCost(costs[u.unit_id || u.id]);
    const receita = Number(u.receita || u.total_revenue || 0);
    return { ...u, custo, receita, margem: receita - custo, margemPct: receita > 0 ? ((receita - custo) / receita) * 100 : null };
  });
  const maxPct = Math.max(...rows.map(r => r.margemPct ?? -Infinity));
  const minPct = Math.min(...rows.map(r => r.margemPct ?? Infinity));
  return (
    <div className="space-y-4">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Receita por tour</h3>} padding="px-5 pb-5 pt-2">
        <ServiceBarChart data={unidades} currency={currency} />
      </Card>
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Custos operacionais por tour</h3>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-n-200">
              {['Tour','Reservas','Receita bruta','Custo','Margem','%',''].map(h => (
                <th key={h} className={`py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 ${h === 'Tour' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{rows.map(r => {
              const isBest  = r.margemPct != null && r.margemPct === maxPct && maxPct > -Infinity;
              const isWorst = r.margemPct != null && r.margemPct === minPct && minPct < Infinity && minPct !== maxPct;
              return (
                <tr key={r.unit_id || r.id} className={`border-b border-n-100 ${isBest ? 'bg-[#ECFDF5]' : isWorst ? 'bg-red-50' : ''}`}>
                  <td className="py-2.5 px-3 font-body font-semibold text-n-800 max-w-[180px] truncate">{r.unit_name || r.name || '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-n-600">{r.num_reservas ?? '—'}</td>
                  <td className="py-2.5 px-3 text-right font-display font-bold text-ocean-700">{fmtMoney(r.receita, currency)}</td>
                  <td className="py-2.5 px-3 text-right font-body text-n-700">{r.custo > 0 ? fmtMoney(r.custo, currency) : <span className="text-n-400 text-xs">—</span>}</td>
                  <td className={`py-2.5 px-3 text-right font-display font-bold ${r.margem >= 0 ? 'text-[#1A7A4A]' : 'text-error'}`}>{r.custo > 0 ? fmtMoney(r.margem, currency) : '—'}</td>
                  <td className="py-2.5 px-3 text-right">{r.margemPct != null && r.custo > 0 ? <span className={`text-xs font-mono font-semibold ${r.margemPct >= 0 ? 'text-[#1A7A4A]' : 'text-error'}`}>{r.margemPct.toFixed(1)}%</span> : <span className="text-n-400 text-xs">—</span>}</td>
                  <td className="py-2.5 px-3"><button onClick={() => onEditCosts(r.unit_id || r.id, r.unit_name || r.name)} className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PrevisaoTab({ forecast, currency, loading }) {
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  if (!forecast) return (
    <Card><div className="text-center py-12"><TrendingUp size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Dados de previsao nao disponiveis.</p><p className="text-xs font-body text-n-400 mt-1">Implemente o endpoint <span className="font-mono">GET /financial/forecast</span> no backend.</p></div></Card>
  );
  const { confirmed_future_revenue, same_period_last_year, historical_avg, weeks } = forecast;
  const isBelow = historical_avg > 0 && confirmed_future_revenue < historical_avg * 0.8;
  return (
    <div className="space-y-4">
      {isBelow && <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-md"><AlertTriangle size={16} strokeWidth={1.75} className="text-yellow-600 shrink-0" /><p className="text-sm font-body text-yellow-700">Previsao abaixo da media historica. Considera acoes de marketing.</p></div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard label="Receita confirmada (prox. periodo)" value={confirmed_future_revenue} format="euro" currency={currency} icon={CalendarDays} />
        <KpiCard label="Mesmo periodo — ano anterior" value={same_period_last_year} format="euro" currency={currency} icon={TrendingUp} />
        <KpiCard label="Media historica mensal" value={historical_avg} format="euro" currency={currency} icon={BarChart2} />
      </div>
      {weeks?.length > 0 && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Previsao semanal</h3>}>
          <div className="space-y-0">{weeks.map((w, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-n-100 last:border-0">
              <span className="text-xs font-mono text-n-500">{w.week_label || w.week}</span>
              <div className="flex items-center gap-6">
                <span className="text-xs font-body text-n-500">{w.num_reservas} reserva(s)</span>
                <span className="font-display font-bold text-ocean-700 text-sm">{fmtMoney(w.receita, currency)}</span>
              </div>
            </div>
          ))}</div>
        </Card>
      )}
    </div>
  );
}

function CaixaTab({ transacoes, currency, loading }) {
  const cash     = (transacoes || []).filter(t => t.payment_method === 'cash');
  const totalRec = cash.reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const pago     = cash.filter(t => t.payment_status === 'paid').reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const pendente = cash.filter(t => t.payment_status === 'pending').reduce((s, t) => s + Number(t.total_amount || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total recebido', value: fmtMoney(totalRec, currency), cls: 'text-n-900' }, { label: 'Confirmado', value: fmtMoney(pago, currency), cls: 'text-[#1A7A4A]' }, { label: 'Por confirmar', value: fmtMoney(pendente, currency), cls: 'text-yellow-700' }].map(m => (
          <div key={m.label} className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4"><p className={`font-display font-bold text-xl ${m.cls}`}>{m.value}</p><p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p></div>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       cash.length === 0 ? <Card><div className="text-center py-12"><Wallet size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Sem pagamentos em dinheiro no periodo.</p></div></Card> :
       <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Pagamentos em dinheiro</h3>}>
         <div className="overflow-x-auto"><table className="w-full text-sm">
           <thead><tr className="border-b border-n-200">{['Data','Cliente','Servico','Montante','Estado'].map(h => <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">{h}</th>)}</tr></thead>
           <tbody>{cash.map(t => (
             <tr key={t.id} className="border-b border-n-100 hover:bg-n-50 transition-colors">
               <td className="py-2.5 px-3 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</td>
               <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">{t.customers?.first_name} {t.customers?.last_name}</td>
               <td className="py-2.5 px-3 font-body text-n-700 max-w-[160px] truncate">{t.units?.name || '—'}</td>
               <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_amount, currency)}</td>
               <td className="py-2.5 px-3"><span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>{PS_LABEL[t.payment_status] || t.payment_status || '—'}</span></td>
             </tr>
           ))}</tbody>
         </table></div>
       </Card>}
    </div>
  );
}

/* ─────────────────── DESPESAS ─────────────────── */

function ExpenseModal({ expense, staff, onSave, onClose }) {
  const isNew = !expense || expense._new;
  const base  = isNew ? null : expense;
  const [form, setForm] = useState({
    category:     base?.category     || EXPENSE_CATEGORIES[0],
    amount:       base?.amount       || '',
    currency:     base?.currency     || 'EUR',
    date:         base?.date         || new Date().toISOString().slice(0, 10),
    staff_id:     base?.staff_id     || '',
    is_recurring: base?.is_recurring || false,
    notes:        base?.notes        || '',
    receipt_url:  base?.receipt_url  || '',
  });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...base, ...form, amount: Number(form.amount), id: base?.id || Date.now().toString() });
  }
  return (
    <Modal open onClose={onClose} title={isNew ? 'Registar despesa' : 'Editar despesa'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Categoria" value={form.category} onChange={set('category')}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Moeda" value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR (€)</option>
            <option value="CVE">CVE</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor" type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} required placeholder="0.00" />
          <Input label="Data" type="date" value={form.date} onChange={set('date')} required />
        </div>
        {['Salarios', 'Comissoes vendedores'].includes(form.category) && staff.length > 0 && (
          <Select label="Colaborador" value={form.staff_id} onChange={set('staff_id')}>
            <option value="">Nenhum especifico</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
          </Select>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setForm(p => ({ ...p, is_recurring: !p.is_recurring }))}
            className={`relative w-10 h-5 rounded-full border-2 border-transparent transition-colors ${form.is_recurring ? 'bg-ocean-700' : 'bg-n-300'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_recurring ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
          <span className="text-xs font-body text-n-600">Despesa recorrente mensal</span>
        </div>
        <Textarea label="Notas" value={form.notes} onChange={set('notes')} rows={2} />
        <Input label="URL do comprovativo" value={form.receipt_url} onChange={set('receipt_url')} placeholder="https://..." />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Registar' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DespesasTab({ currency, staff }) {
  const [expenses,    setExpenses]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);
  const [filterCat,   setFilterCat]   = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setLoading(true);
    listExpenses().then(d => setExpenses(d || [])).finally(() => setLoading(false));
  }, []);

  function handleSave(exp) {
    if (exp.id && expenses.find(e => e.id === exp.id)) {
      updateExpenseLocal(exp.id, exp);
      setExpenses(prev => prev.map(e => e.id === exp.id ? exp : e));
    } else {
      const added = addExpenseLocal(exp);
      setExpenses(prev => [...prev, added]);
    }
    setModal(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Eliminar esta despesa?')) return;
    deleteExpenseLocal(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  const periodExp = expenses.filter(e => {
    const d = e.date || '';
    const monthMatch = !filterMonth || d.startsWith(filterMonth);
    const catMatch   = !filterCat   || e.category === filterCat;
    return monthMatch && catMatch;
  });

  const totalPeriod = periodExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  /* Category summary */
  const byCat = EXPENSE_CATEGORIES.map(cat => ({
    name: cat,
    total: periodExp.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  /* Recurring alerts */
  const recurring = expenses.filter(e => e.is_recurring);
  const thisMonth = filterMonth;
  const missingRecurring = recurring.filter(r => !expenses.some(e => e.category === r.category && !e.is_recurring && (e.date || '').startsWith(thisMonth)));

  /* Chart data */
  const chartData = byCat.slice(0, 8);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return <div className="bg-white border border-n-200 rounded-sm shadow-sm px-3 py-2 text-xs font-body"><p className="font-semibold text-n-700">{payload[0].name}</p><p style={{ color: payload[0].payload.fill }}>€{Math.round(payload[0].value).toLocaleString('pt-PT')}</p></div>;
  };

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {missingRecurring.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertTriangle size={15} strokeWidth={1.75} className="text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-body font-semibold text-yellow-700">Despesas recorrentes em falta este mes</p>
            <p className="text-xs font-body text-yellow-600 mt-0.5">{missingRecurring.slice(0, 3).map(r => r.category).join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="h-9 px-3 text-sm font-body border border-n-200 rounded-sm bg-white focus:outline-none focus:border-ocean-700" />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="h-9 px-3 text-sm font-body border border-n-200 rounded-sm bg-white focus:outline-none focus:border-ocean-700">
          <option value="">Todas as categorias</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-mono text-n-500">Total: <span className="font-bold text-n-800">€{Math.round(totalPeriod).toLocaleString('pt-PT')}</span></span>
          <Button icon={Plus} size="sm" onClick={() => setModal({ _new: true })}>Registar despesa</Button>
        </div>
      </div>

      {/* Summary cards */}
      {byCat.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {byCat.slice(0, 4).map((c, i) => (
            <div key={c.name} className="bg-white border border-n-200 rounded-md px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i] }} />
                <p className="text-xs font-body text-n-500 truncate">{c.name}</p>
              </div>
              <p className="font-display font-bold text-lg text-n-900">€{Math.round(c.total).toLocaleString('pt-PT')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card padding="px-5 pb-5 pt-3" header={<h3 className="font-display font-semibold text-sm text-n-700">Despesas por categoria</h3>}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {chartData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Pie>
                <ChartTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card padding="px-5 pb-5 pt-3" header={<h3 className="font-display font-semibold text-sm text-n-700">Detalhes</h3>}>
            <div className="space-y-2 mt-2">
              {byCat.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <span className="text-xs font-body text-n-600 flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-mono font-semibold text-n-800">€{Math.round(c.total).toLocaleString('pt-PT')}</span>
                  <span className="text-xs font-mono text-n-400 w-10 text-right">{totalPeriod > 0 ? ((c.total / totalPeriod) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* List */}
      {loading ? <div className="flex justify-center py-12"><LoadingSpinner size={32} /></div> :
       periodExp.length === 0 ? (
        <Card><div className="text-center py-12"><TrendingDown size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Sem despesas no periodo seleccionado.</p></div></Card>
      ) : (
        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-n-200">{['Data','Categoria','Colaborador','Valor','Recorrente','Notas',''].map(h => <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-n-100">
                {[...periodExp].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(e => (
                  <tr key={e.id} className="hover:bg-n-50 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="py-3 px-4 font-body font-semibold text-n-800">{e.category}</td>
                    <td className="py-3 px-4 text-xs font-body text-n-500">{e.staff_id ? (staff.find(s => s.id === e.staff_id)?.name || '—') : '—'}</td>
                    <td className="py-3 px-4 font-display font-bold text-error whitespace-nowrap">- {fmtMoney(e.amount, currency)}</td>
                    <td className="py-3 px-4">{e.is_recurring ? <span className="text-xs font-mono text-ocean-700 bg-ocean-50 px-1.5 py-0.5 rounded-xs">Recorrente</span> : '—'}</td>
                    <td className="py-3 px-4 text-xs font-body text-n-500 max-w-[150px] truncate">{e.notes || '—'}</td>
                    <td className="py-3 px-4"><div className="flex gap-0.5">
                      <button onClick={() => setModal(e)} className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button>
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors"><Trash2 size={13} strokeWidth={1.75} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && <ExpenseModal expense={modal} staff={staff} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ─────────────────── SALARIOS ─────────────────── */

function SalariosTab({ currency }) {
  const [staffList,    setStaffList]    = useState([]);
  const [salaryConfig, setSalaryConfig] = useState({});
  const [payments,     setPayments]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [editModal,    setEditModal]    = useState(null);
  const [payModal,     setPayModal]     = useState(null);
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();

  useEffect(() => {
    setLoading(true);
    listStaff()
      .then(d => setStaffList((d || []).filter(s => s.status === 'active')))
      .catch(() => {})
      .finally(() => {
        setSalaryConfig(getSalaryConfig());
        setPayments(getSalaryPayments());
        setLoading(false);
      });
  }, []);

  function getConfig(staffId) {
    return salaryConfig[staffId] || { base: 0, food: 0, transport: 0, inps_pct: 15 };
  }

  function totalCost(cfg) {
    const base = Number(cfg.base || 0);
    return base + Number(cfg.food || 0) + Number(cfg.transport || 0) + base * (Number(cfg.inps_pct || 0) / 100);
  }

  function handleSaveConfig(staffId, cfg) {
    const next = { ...salaryConfig, [staffId]: cfg };
    setSalaryConfig(next);
    persistSalaryConfig(staffId, cfg);
    setEditModal(null);
  }

  function handlePayment(staffId, amount) {
    const payment = addSalaryPayment({ staffId, staffName: staffList.find(s => s.id === staffId)?.name, month: curMonth, year: curYear, amount });
    setPayments(prev => [...prev, payment]);
    setPayModal(null);
  }

  const totalFolha = staffList.reduce((s, st) => s + totalCost(getConfig(st.id)), 0);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-n-200 rounded-md px-4 py-3"><p className="font-display font-bold text-xl text-n-900">{staffList.length}</p><p className="text-xs font-body text-n-500">Colaboradores activos</p></div>
        <div className="bg-white border border-n-200 rounded-md px-4 py-3"><p className="font-display font-bold text-xl text-error">{fmtMoney(totalFolha, currency)}</p><p className="text-xs font-body text-n-500">Folha salarial total/mes</p></div>
        <div className="bg-white border border-n-200 rounded-md px-4 py-3"><p className="font-display font-bold text-xl text-[#1A7A4A]">{payments.filter(p => p.month === curMonth && p.year === curYear).length}</p><p className="text-xs font-body text-n-500">Pagos este mes</p></div>
        <div className="bg-white border border-n-200 rounded-md px-4 py-3"><p className="font-display font-bold text-xl text-yellow-700">{staffList.length - payments.filter(p => p.month === curMonth && p.year === curYear).length}</p><p className="text-xs font-body text-n-500">Por pagar este mes</p></div>
      </div>

      {staffList.length === 0 ? (
        <Card><div className="text-center py-12"><Users size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Sem colaboradores activos.</p></div></Card>
      ) : (
        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-n-200">
                {['Colaborador','Salario base','Subsidios','INPS patronal','Custo total/mes','Estado',''].map(h => <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-n-100">
                {staffList.map(s => {
                  const cfg  = getConfig(s.id);
                  const cost = totalCost(cfg);
                  const paid = payments.some(p => p.staffId === s.id && p.month === curMonth && p.year === curYear);
                  return (
                    <tr key={s.id} className="hover:bg-n-50 transition-colors">
                      <td className="py-3 px-4"><p className="font-body font-semibold text-n-900">{s.name}</p><p className="text-xs font-body text-n-500">{s.role}</p></td>
                      <td className="py-3 px-4 font-mono text-n-700">{cfg.base ? fmtMoney(cfg.base, currency) : <span className="text-n-300">—</span>}</td>
                      <td className="py-3 px-4 text-xs font-body text-n-500">{(cfg.food || cfg.transport) ? `${cfg.food ? `Alim. ${fmtMoney(cfg.food, currency)}` : ''} ${cfg.transport ? `Transp. ${fmtMoney(cfg.transport, currency)}` : ''}`.trim() : '—'}</td>
                      <td className="py-3 px-4 font-mono text-n-600">{cfg.inps_pct || 15}%</td>
                      <td className="py-3 px-4 font-display font-bold text-error">{fmtMoney(cost, currency)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-xs ${paid ? 'bg-[#ECFDF5] text-[#1A7A4A]' : 'bg-yellow-50 text-yellow-700'}`}>
                          {paid ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="py-3 px-4"><div className="flex gap-1">
                        <button onClick={() => setEditModal({ staff: s, cfg })} className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button>
                        {!paid && <button onClick={() => setPayModal({ staff: s, amount: cost })} className="text-xs px-2 py-1 bg-ocean-700 text-white rounded-xs hover:bg-ocean-800 transition-colors font-body whitespace-nowrap">Pagar</button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit salary modal */}
      {editModal && (
        <Modal open onClose={() => setEditModal(null)} title={`Salario — ${editModal.staff.name}`} size="sm">
          <SalaryForm cfg={editModal.cfg} onSave={cfg => handleSaveConfig(editModal.staff.id, cfg)} onClose={() => setEditModal(null)} />
        </Modal>
      )}

      {/* Pay modal */}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={`Registar pagamento — ${payModal.staff.name}`} size="sm">
          <div className="space-y-4">
            <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm">
              <p className="text-xs font-body text-n-500">Valor calculado</p>
              <p className="font-display font-bold text-lg text-n-800">{fmtMoney(payModal.amount, currency)}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setPayModal(null)} className="flex-1">Cancelar</Button>
              <Button icon={Check} onClick={() => handlePayment(payModal.staff.id, payModal.amount)} className="flex-1">Confirmar pagamento</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SalaryForm({ cfg, onSave, onClose }) {
  const [form, setForm] = useState({ base: cfg.base || 0, food: cfg.food || 0, transport: cfg.transport || 0, inps_pct: cfg.inps_pct || 15 });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const total = Number(form.base) + Number(form.food) + Number(form.transport) + Number(form.base) * (Number(form.inps_pct) / 100);
  return (
    <div className="space-y-3">
      <Input label="Salario base (€/mes)" type="number" min="0" step="1" value={form.base} onChange={set('base')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Subsidio alimentacao" type="number" min="0" step="1" value={form.food} onChange={set('food')} />
        <Input label="Subsidio transporte" type="number" min="0" step="1" value={form.transport} onChange={set('transport')} />
      </div>
      <Input label="INPS patronal (%)" type="number" min="0" max="100" step="0.5" value={form.inps_pct} onChange={set('inps_pct')} hint="Default: 15% (Cabo Verde)" />
      <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm flex justify-between">
        <span className="text-xs font-body text-n-500">Custo total mensal</span>
        <span className="font-display font-bold text-sm text-error">€{Math.round(total).toLocaleString('pt-PT')}</span>
      </div>
      <div className="flex gap-3"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button icon={Save} onClick={() => onSave({ base: Number(form.base), food: Number(form.food), transport: Number(form.transport), inps_pct: Number(form.inps_pct) })} className="flex-1">Guardar</Button></div>
    </div>
  );
}

/* ─────────────────── COMISSOES VENDEDORES ─────────────────── */

function ComissoesTab({ currency }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellerComms, setSellerComms] = useState({});
  const [payModal, setPayModal] = useState(null);
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true);
    listStaff()
      .then(d => {
        const v = (d || []).filter(s => s.role === 'Vendedor de Praia' && s.status === 'active');
        setSellers(v);
        const commsMap = {};
        v.forEach(s => { commsMap[s.id] = listSellerCommissions(s.id); });
        setSellerComms(commsMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getMonthComms(sellerId) {
    const all = sellerComms[sellerId];
    if (!all || typeof all.then === 'function') return [];
    return all.filter(c => (c.created_at || '').startsWith(month));
  }

  function handlePay(sellerId, commId) {
    markCommPaid(commId);
    setSellerComms(prev => ({
      ...prev,
      [sellerId]: (prev[sellerId] || []).map(c => c.id === commId ? { ...c, status: 'paid', paid_at: new Date().toISOString() } : c),
    }));
    setPayModal(null);
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  if (sellers.length === 0) return (
    <Card><div className="text-center py-12"><Users size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Sem vendedores de praia activos.</p><p className="text-xs font-body text-n-400 mt-1">Cria colaboradores com funcao "Vendedor de Praia" na secção Colaboradores.</p></div></Card>
  );

  return (
    <div className="space-y-3">
      {sellers.map(s => {
        const comms   = getMonthComms(s.id);
        const total   = comms.reduce((sum, c) => sum + c.amount, 0);
        const paid    = comms.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
        const pending = total - paid;
        return (
          <Card key={s.id} padding="px-5 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-n-900">{s.name}</p>
                <p className="text-xs font-body text-n-500">{getSellerCommissionPct(s.id, 10)}% comissao · {comms.length} reserva(s) este mes</p>
              </div>
              <div className="flex gap-4 shrink-0">
                {[{l: 'Total', v: fmtMoney(total, currency), c: 'text-n-800'}, {l: 'Pago', v: fmtMoney(paid, currency), c: 'text-[#1A7A4A]'}, {l: 'Pendente', v: fmtMoney(pending, currency), c: 'text-yellow-700'}].map(m => (
                  <div key={m.l} className="text-center"><p className={`font-display font-bold text-sm ${m.c}`}>{m.v}</p><p className="text-[9px] font-mono text-n-400">{m.l}</p></div>
                ))}
              </div>
              {pending > 0 && <Button size="sm" variant="secondary" onClick={() => setPayModal({ seller: s, pending })}>Registar pag.</Button>}
            </div>
            {comms.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {comms.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="font-body text-n-600 truncate">{c.tour_name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-[#1A7A4A]">{fmtMoney(c.amount, currency)}</span>
                      <span className={`font-mono px-1.5 py-0.5 rounded-xs ${c.status === 'paid' ? 'bg-[#ECFDF5] text-[#1A7A4A]' : 'bg-yellow-50 text-yellow-700'}`}>{c.status === 'paid' ? 'Pago' : 'Pendente'}</span>
                      {c.status === 'pending' && <button onClick={() => handlePay(s.id, c.id)} className="text-ocean-700 hover:underline">Pagar</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={`Pagar comissoes — ${payModal.seller.name}`} size="sm">
          <div className="space-y-4">
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-sm"><p className="text-xs font-body text-yellow-700">Comissoes pendentes este mes: <span className="font-bold">{fmtMoney(payModal.pending, currency)}</span></p></div>
            <p className="text-xs font-body text-n-500">Esta accao marca todas as comissoes pendentes deste vendedor como pagas.</p>
            <div className="flex gap-3"><Button variant="secondary" onClick={() => setPayModal(null)} className="flex-1">Cancelar</Button><Button icon={Check} onClick={() => { const comms = getMonthComms(payModal.seller.id).filter(c => c.status === 'pending'); comms.forEach(c => handlePay(payModal.seller.id, c.id)); }} className="flex-1">Confirmar pagamento</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────── OBRIGACOES ─────────────────── */

function ObrigacoesTab({ currency }) {
  const [obl, setObl] = useState(() => getObligations());
  const now  = new Date();
  const day  = now.getDate();
  const inpsDue = new Date(now.getFullYear(), now.getMonth(), 15);
  const daysToInps = Math.ceil((inpsDue - now) / (1000 * 60 * 60 * 24));

  function saveObl(next) { setObl(next); setObligations(next); }

  function Insurance({ ins, idx }) {
    const renewal = ins.renewal_date ? new Date(ins.renewal_date + 'T00:00:00Z') : null;
    const daysToRenew = renewal ? Math.ceil((renewal - now) / (1000 * 60 * 60 * 24)) : null;
    const isCritical = daysToRenew != null && daysToRenew <= 30;
    return (
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${isCritical ? 'bg-yellow-50 border-yellow-200' : 'bg-n-50 border-n-100'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-body font-semibold text-n-800">{ins.name}</p>
          <p className="text-[10px] font-mono text-n-400">{renewal ? `Renovacao: ${fmtDate(ins.renewal_date)}${isCritical ? ` (${daysToRenew}d)` : ''}` : 'Sem data'}</p>
        </div>
        <span className="text-xs font-body text-n-600 shrink-0">{ins.amount_annual ? `€${ins.amount_annual}/ano` : '—'}</span>
        {isCritical && <AlertTriangle size={14} strokeWidth={1.75} className="text-yellow-600 shrink-0" />}
        <button onClick={() => { const list = (obl.insurances || []).filter((_, i) => i !== idx); saveObl({ ...obl, insurances: list }); }} className="p-1 text-n-400 hover:text-error transition-colors"><Trash2 size={12} strokeWidth={1.75} /></button>
      </div>
    );
  }

  const [newIns, setNewIns] = useState({ name: '', renewal_date: '', amount_annual: '' });

  return (
    <div className="space-y-5 max-w-2xl">
      {/* INPS */}
      <Card padding="px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-sm text-n-700">INPS — Contribuicoes mensais</h3>
          {daysToInps <= 5 && daysToInps > 0 && <span className="flex items-center gap-1 text-xs font-mono text-error bg-red-50 px-2 py-0.5 rounded-xs"><AlertTriangle size={10} strokeWidth={2} />Prazo em {daysToInps}d</span>}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">Data de entrega</span>
            <span className="font-mono text-n-800">Dia 15 de cada mes</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">Contribuicao patronal</span>
            <span className="font-mono text-n-800">15% dos salarios brutos</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">Contribuicao do trabalhador</span>
            <span className="font-mono text-n-800">8% dos salarios brutos</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-n-100">
          <select
            value={obl.inps_status_current || 'pending'}
            onChange={e => saveObl({ ...obl, inps_status_current: e.target.value })}
            className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white focus:outline-none">
            <option value="pending">Pendente este mes</option>
            <option value="paid">Pago este mes</option>
          </select>
        </div>
      </Card>

      {/* IUR */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">IUR — Imposto Unico sobre Rendimentos</h3>
        <p className="text-xs font-body text-n-500 mb-3">Retenção na fonte mensal sobre salarios. Declaracao anual em Abril.</p>
        <textarea
          value={obl.iur_notes || ''}
          onChange={e => saveObl({ ...obl, iur_notes: e.target.value })}
          placeholder="Notas sobre IUR, valores estimados, contabilista responsavel..."
          rows={3}
          className="w-full px-3 py-2 text-sm font-body border border-n-200 rounded-sm bg-n-50 focus:outline-none focus:border-ocean-700 resize-none"
        />
      </Card>

      {/* Seguros */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Seguros</h3>
        <div className="space-y-2 mb-3">
          {(obl.insurances || []).map((ins, i) => <Insurance key={i} ins={ins} idx={i} />)}
          {(obl.insurances || []).length === 0 && <p className="text-xs font-body text-n-400">Sem seguros registados.</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input value={newIns.name} onChange={e => setNewIns(p => ({ ...p, name: e.target.value }))} placeholder="Nome do seguro" className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-n-50 focus:outline-none focus:border-ocean-700" />
          <input type="date" value={newIns.renewal_date} onChange={e => setNewIns(p => ({ ...p, renewal_date: e.target.value }))} className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-n-50 focus:outline-none focus:border-ocean-700" />
          <div className="flex gap-1">
            <input type="number" value={newIns.amount_annual} onChange={e => setNewIns(p => ({ ...p, amount_annual: e.target.value }))} placeholder="€/ano" className="flex-1 h-8 px-2 text-xs font-mono border border-n-200 rounded bg-n-50 focus:outline-none focus:border-ocean-700" />
            <button onClick={() => { if (!newIns.name) return; saveObl({ ...obl, insurances: [...(obl.insurances || []), { ...newIns, amount_annual: Number(newIns.amount_annual) }] }); setNewIns({ name: '', renewal_date: '', amount_annual: '' }); }} className="h-8 w-8 flex items-center justify-center bg-ocean-700 text-white rounded hover:bg-ocean-800 transition-colors"><Plus size={14} strokeWidth={2} /></button>
          </div>
        </div>
      </Card>

      {/* SalDesk */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Subscricao SalDesk</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Plano actual" value={obl.saldesk_plan || 'starter'} onChange={e => saveObl({ ...obl, saldesk_plan: e.target.value })}>
            <option value="starter">Starter — €29/mes</option>
            <option value="business">Business — €59/mes</option>
            <option value="pro">Pro — €99/mes</option>
          </Select>
          <Input label="Data de renovacao" type="date" value={obl.saldesk_renewal || ''} onChange={e => saveObl({ ...obl, saldesk_renewal: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────── RESULTADO ─────────────────── */

function getExpensesSync() {
  try { return JSON.parse(localStorage.getItem('saldesk_expenses_v1') || '[]'); } catch { return []; }
}

function ResultadoTab({ resumo, currency, sazonal }) {
  const now     = new Date();
  const month   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

  const allExp = getExpensesSync();
  const monthExp = allExp.filter(e => (e.date || '').startsWith(month));
  const prevExp  = allExp.filter(e => (e.date || '').startsWith(prevMonth));

  const salConfig  = getSalaryConfig();
  const staffs     = Object.values(salConfig);
  const totalSal   = staffs.reduce((s, c) => s + Number(c.base || 0) + Number(c.food || 0) + Number(c.transport || 0) + Number(c.base || 0) * (Number(c.inps_pct || 15) / 100), 0);

  const receita   = Number(resumo?.atual?.receita || 0);
  const totalDespesas = monthExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const resultado = receita - totalDespesas - totalSal;
  const margem    = receita > 0 ? (resultado / receita) * 100 : 0;

  /* Chart: last 6 months */
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rec = (sazonal || []).find(s => (s.date || '').startsWith(m));
    const dep = allExp.filter(e => (e.date || '').startsWith(m)).reduce((s, e) => s + Number(e.amount || 0), 0);
    return { name: MONTHS_PT[d.getMonth()], receita: Math.round(rec?.value || rec?.total || 0), despesas: Math.round(dep + totalSal) };
  });

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Receita bruta',         value: fmtMoney(receita, currency),        color: 'text-ocean-700'  },
          { label: 'Despesas operacionais', value: fmtMoney(totalDespesas, currency),   color: 'text-error'      },
          { label: 'Folha salarial',        value: fmtMoney(totalSal, currency),        color: 'text-error'      },
          { label: 'Resultado liquido',     value: fmtMoney(resultado, currency),       color: resultado >= 0 ? 'text-[#1A7A4A]' : 'text-error' },
          { label: 'Margem',                value: `${margem.toFixed(1)}%`,             color: margem >= 20 ? 'text-[#1A7A4A]' : margem >= 0 ? 'text-yellow-700' : 'text-error' },
          { label: 'Reservas no periodo',   value: resumo?.atual?.num_reservas ?? '—',   color: 'text-n-900'      },
        ].map(m => (
          <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3">
            <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
            <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Receitas vs Despesas chart */}
      <Card padding="px-5 pb-5 pt-3" header={<h3 className="font-display font-semibold text-sm text-n-700">Receitas vs Despesas — ultimos 6 meses</h3>}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EC" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={v => v > 999 ? `€${Math.round(v / 1000)}k` : `€${v}`} />
            <ChartTooltip contentStyle={{ fontSize: 11, fontFamily: 'DM Sans', border: '1px solid #E5E8EC', borderRadius: 4 }} formatter={v => `€${Math.round(v).toLocaleString('pt-PT')}`} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Mono' }} />
            <Bar dataKey="receita"  name="Receita"  fill="#0D5470" radius={[2,2,0,0]} />
            <Bar dataKey="despesas" name="Despesas" fill="#B91C1C" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Breakdown */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Decomposicao do resultado</h3>
        <div className="space-y-2">
          {[
            { label: 'Receita bruta',     value: receita,        sign: '+', color: 'text-ocean-700' },
            { label: 'Despesas operac.',  value: totalDespesas,  sign: '−', color: 'text-error'     },
            { label: 'Folha salarial',    value: totalSal,       sign: '−', color: 'text-error'     },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-n-100 last:border-0">
              <span className="text-sm font-body text-n-700">{r.label}</span>
              <span className={`font-display font-bold text-sm ${r.color}`}>{r.sign} {fmtMoney(r.value, currency)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 pt-3 border-t-2 border-n-300">
            <span className="text-sm font-body font-bold text-n-800">Resultado liquido</span>
            <span className={`font-display font-bold text-base ${resultado >= 0 ? 'text-[#1A7A4A]' : 'text-error'}`}>{resultado >= 0 ? '+' : '−'} {fmtMoney(Math.abs(resultado), currency)}</span>
          </div>
        </div>
      </Card>

      {/* Export */}
      <div className="flex gap-3">
        <Button variant="secondary" icon={FileText} onClick={() => window.print()} className="flex-1">
          Exportar PDF
        </Button>
        <Button variant="secondary" icon={FileSpreadsheet} className="flex-1">
          Exportar Excel
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────── MAIN ─────────────────── */
export default function Financial() {
  useT();
  const { canAccess } = usePlan();
  const [activeSec,     setActiveSec]     = useState('receitas');
  const [activeTab,     setActiveTab]     = useState('geral');
  const [periodo,       setPeriodo]       = useState(ultimos30);
  const [presetAtivo,   setPresetAtivo]   = useState(0);
  const [granularidade, setGran]          = useState('day');
  const [currency,      setCurrency]      = useState('EUR');
  const [exporting,     setExporting]     = useState('');

  /* Receitas data */
  const [resumo,     setResumo]     = useState(null);
  const [receita,    setReceita]    = useState([]);
  const [sazonal,    setSazonal]    = useState([]);
  const [unidades,   setUnidades]   = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [canais,     setCanais]     = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingTx,  setLoadingTx]  = useState(false);
  const [forecast,        setForecast]       = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastLoaded,  setForecastLoaded]  = useState(false);
  const [costs,       setCosts]      = useState(loadCosts);
  const [editingUnit, setEditingUnit] = useState(null);

  /* Staff (shared between Salarios and Comissoes tabs) */
  const [staff, setStaff] = useState([]);

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
    try { const data = await getTransacoes(p.inicio, p.fim); setTransacoes(data || []); }
    catch { setTransacoes([]); }
    finally { setLoadingTx(false); }
  }, []);

  useEffect(() => { carregar(periodo, granularidade); carregarTx(periodo); }, [periodo, granularidade]);

  useEffect(() => {
    const y = new Date().getFullYear();
    getReceita(`${y}-01-01`, `${y}-12-31`, 'month').then(d => setSazonal(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'previsao' && activeSec === 'receitas' && !forecastLoaded) {
      setLoadingForecast(true);
      getForecast().then(f => { setForecast(f); setForecastLoaded(true); }).catch(() => { setForecastLoaded(true); }).finally(() => setLoadingForecast(false));
    }
  }, [activeTab, activeSec, forecastLoaded]);

  /* Lazy-load staff for salary/commission tabs */
  useEffect(() => {
    if (['salarios', 'comissoes', 'despesas'].includes(activeSec) && staff.length === 0) {
      listStaff().then(d => setStaff(d || [])).catch(() => {});
    }
  }, [activeSec]);

  function selectPreset(i) { const p = PRESETS[i].fn(); setPresetAtivo(i); setPeriodo(p); }

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

  const atual    = resumo?.atual || {};
  const variacao = resumo?.variacao || {};
  const directas = (canais || []).filter(c => ['direct', 'public', 'manual'].includes(c.source)).reduce((s, c) => s + (c.num_reservas || 0), 0);
  const ota = (canais || []).filter(c => !['direct', 'public', 'manual'].includes(c.source)).reduce((s, c) => s + (c.num_reservas || 0), 0);
  const totalBookings = directas + ota;
  const directaPct = totalBookings > 0 ? Math.round((directas / totalBookings) * 100) : null;
  const ticketMedio = atual.num_reservas > 0 ? Number(atual.receita || 0) / atual.num_reservas : 0;
  const totalCustos = Object.values(costs).reduce((s, c) => s + unitTotalCost(c), 0);
  const receitaNum  = Number(atual.receita || 0);
  const margemLiq   = receitaNum > 0 ? receitaNum - totalCustos : null;
  const crescimento = variacao.receita != null && resumo?.anterior?.receita > 0
    ? ((receitaNum - Number(resumo.anterior.receita)) / Number(resumo.anterior.receita)) * 100
    : null;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        actions={
          activeSec === 'receitas' ? (
            <div className="flex gap-2">
              <Button variant="secondary" icon={FileSpreadsheet} size="sm" loading={exporting === 'excel'} onClick={() => handleExport('excel')}>Excel</Button>
              <Button variant="secondary" icon={FileText} size="sm" loading={exporting === 'pdf'} onClick={() => handleExport('pdf')}>PDF</Button>
            </div>
          ) : null
        }
      />

      {/* Section tabs (top level) */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-n-200 mb-5">
        {SECTIONS.map(({ key, label, Icon, pro }) => {
          const locked = pro && !canAccess('financeiro-completo');
          return (
            <button key={key} onClick={() => setActiveSec(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeSec === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
              }`}>
              <Icon size={15} strokeWidth={1.75} />{label}
              {locked && <Lock size={11} strokeWidth={1.75} className="text-n-300 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* ── RECEITAS section ── */}
      {activeSec === 'receitas' && (
        <>
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

          {/* Receitas sub-tabs */}
          <div className="flex gap-1 border-b border-n-200 mb-5">
            {RECEITAS_TABS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
                  activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
                }`}>
                <Icon size={15} strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>

          {/* Receitas tab content */}
          {loading && activeTab === 'geral' ? (
            <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
          ) : activeTab === 'geral' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Receita total" value={atual.receita} delta={variacao.receita} deltaLabel="vs periodo ant." icon={Euro} format="euro" currency={currency} />
                <KpiCard label={`Directas ${directaPct != null ? directaPct + '%' : ''}`} value={directas} sub={ota > 0 ? `${ota} via OTA` : undefined} icon={BarChart2} format="number" />
                <KpiCard label="Ticket medio" value={ticketMedio} icon={Receipt} format="euro" currency={currency} />
                <KpiCard label={`Margem liquida${margemLiq != null && totalCustos > 0 ? ` (${((receitaNum - totalCustos) / receitaNum * 100).toFixed(0)}%)` : ''}`} value={margemLiq} delta={crescimento} deltaLabel="crescimento" icon={TrendingUp} format="euro" currency={currency} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2" header={<div className="flex items-center justify-between"><h3 className="font-display font-semibold text-sm text-n-700">Receita por periodo</h3><span className="text-xs font-mono text-n-400">{periodo.inicio} — {periodo.fim}</span></div>} padding="px-5 pb-5 pt-2">
                  <RevenueChart data={receita} granularidade={granularidade} currency={currency} />
                </Card>
                <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Por canal</h3>} padding="px-5 pb-5 pt-2">
                  <ChannelChart data={canais} />
                </Card>
              </div>
              {sazonal.length > 0 && (
                <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Sazonalidade anual — {new Date().getFullYear()}</h3>} padding="px-5 pb-5 pt-2">
                  <RevenueChart data={sazonal} granularidade="month" currency={currency} />
                </Card>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Top 5 servicos por receita</h3>} padding="px-5 pb-5 pt-2"><ServiceBarChart data={unidades} currency={currency} /></Card>
                <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Top clientes</h3>}><TopCustomersList data={clientes} /></Card>
              </div>
              {resumo?.anterior && <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Comparativo com periodo anterior</h3>}><Comparativo resumo={resumo} currency={currency} /></Card>}
              <Card header={<div className="flex items-center justify-between"><h3 className="font-display font-semibold text-sm text-n-700">Transacoes</h3><button onClick={() => carregarTx(periodo)} className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><RefreshCw size={13} strokeWidth={1.75} /></button></div>}>
                <TransacoesTable transacoes={transacoes} currency={currency} loading={loadingTx} />
              </Card>
            </div>
          ) : activeTab === 'portour' ? (
            loading ? <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div> :
            <PorTourTab unidades={unidades} currency={currency} costs={costs} onEditCosts={(id, name) => setEditingUnit({ id, name })} />
          ) : activeTab === 'previsao' ? (
            <PrevisaoTab forecast={forecast} currency={currency} loading={loadingForecast} />
          ) : activeTab === 'caixa' ? (
            <CaixaTab transacoes={transacoes} currency={currency} loading={loadingTx} />
          ) : null}
        </>
      )}

      {activeSec === 'despesas'   && <PlanGuard plan="pro" feature="financeiro-completo"><DespesasTab   currency={currency} staff={staff} /></PlanGuard>}
      {activeSec === 'salarios'   && <PlanGuard plan="pro" feature="financeiro-completo"><SalariosTab   currency={currency} /></PlanGuard>}
      {activeSec === 'comissoes'  && <ComissoesTab  currency={currency} />}
      {activeSec === 'obrigacoes' && <PlanGuard plan="pro" feature="financeiro-completo"><ObrigacoesTab currency={currency} /></PlanGuard>}
      {activeSec === 'resultado'  && <PlanGuard plan="pro" feature="financeiro-completo"><ResultadoTab  resumo={resumo} currency={currency} sazonal={sazonal} /></PlanGuard>}

      {/* CVE/EUR toggle for non-receitas sections */}
      {activeSec !== 'receitas' && (
        <div className="fixed bottom-5 right-5 flex gap-0.5 bg-ocean-900 rounded-sm p-0.5 shadow-lg">
          {['EUR', 'CVE'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 rounded-xs text-xs font-mono font-semibold transition-colors ${currency === c ? 'bg-ocean-700 text-white' : 'text-ocean-300 hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Cost edit modal */}
      {editingUnit && (
        <CostEditModal open={!!editingUnit} onClose={() => setEditingUnit(null)} unitId={editingUnit.id} unitName={editingUnit.name} costs={costs[editingUnit.id]} onSave={handleSaveCosts} />
      )}
    </div>
  );
}
