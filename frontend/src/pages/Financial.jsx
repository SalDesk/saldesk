import { useState, useEffect, useCallback } from 'react';
import {
  Euro, BarChart2, BookOpen, TrendingUp, TrendingDown,
  Download, FileSpreadsheet, FileText, ArrowUpRight,
  ArrowDownRight, Minus, CreditCard, Wallet, Receipt,
  Filter, ChevronDown, RefreshCw,
} from 'lucide-react';
import {
  getResumo, getReceita, getUnidades, getTopClientes,
  getCanais, exportExcel, getTransacoes, exportPdf,
} from '../services/financeiroService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import KpiCard from '../components/financial/KpiCard';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import TopCustomersList from '../components/financial/TopCustomersList';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── helpers ── */
const EUR_CVE = 110;

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

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}
function fmtMoney(v, currency) {
  const n = Number(v || 0);
  if (currency === 'CVE') return `${Math.round(n * EUR_CVE).toLocaleString('pt-PT')} CVE`;
  return `€${Math.round(n).toLocaleString('pt-PT')}`;
}

/* ── Transactions Table ── */
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
      {/* Filters */}
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

      {/* Table */}
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
                  <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">
                    {t.customers?.first_name} {t.customers?.last_name}
                  </td>
                  <td className="py-2.5 px-3 font-body text-n-700 max-w-[140px] truncate">
                    {t.units?.name || '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs font-mono text-n-500">{SRC_LABEL[t.source] || t.source || '—'}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs font-body text-n-600">{PM_LABEL[t.payment_method] || t.payment_method || '—'}</span>
                  </td>
                  <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">
                    {fmtMoney(t.total_amount, currency)}
                  </td>
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

/* ── Comparativo section ── */
function Comparativo({ resumo, currency }) {
  if (!resumo?.variacao) return null;
  const { atual, anterior, variacao } = resumo;
  if (!atual || !anterior) return null;

  const rows = [
    { label: 'Receita',    atual: atual.receita,       ant: anterior.receita,       fmt: 'euro', delta: variacao.receita },
    { label: 'Reservas',   atual: atual.num_reservas,  ant: anterior.num_reservas,  fmt: 'num',  delta: variacao.num_reservas },
    { label: 'Ocupacao',   atual: atual.taxa_ocupacao, ant: anterior.taxa_ocupacao, fmt: 'pct',  delta: variacao.taxa_ocupacao },
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
            <th className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">Metrica</th>
            <th className="text-right py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">Periodo actual</th>
            <th className="text-right py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">Periodo anterior</th>
            <th className="text-right py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">Variacao</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const up = r.delta > 0;
            const neutral = r.delta === 0 || r.delta == null;
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

/* ── Main ── */
export default function Financial() {
  const t = useT();
  const [periodo,       setPeriodo]      = useState(ultimos30());
  const [presetAtivo,   setPresetAtivo]  = useState(0);
  const [granularidade, setGran]         = useState('day');
  const [currency,      setCurrency]     = useState('EUR');
  const [exporting,     setExporting]    = useState('');

  const [resumo,     setResumo]     = useState(null);
  const [receita,    setReceita]    = useState([]);
  const [unidades,   setUnidades]   = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [canais,     setCanais]     = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingTx,  setLoadingTx]  = useState(false);

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

  /* KPI derivados */
  const atual    = resumo?.atual || {};
  const variacao = resumo?.variacao || {};

  const directas = (canais || [])
    .filter(c => ['direct', 'public', 'manual'].includes(c.source))
    .reduce((s, c) => s + (c.num_reservas || 0), 0);
  const ota = (canais || [])
    .filter(c => !['direct', 'public', 'manual'].includes(c.source))
    .reduce((s, c) => s + (c.num_reservas || 0), 0);

  const ticketMedio = atual.num_reservas > 0
    ? Number(atual.receita || 0) / atual.num_reservas
    : 0;

  const crescimento = variacao.receita != null && resumo?.anterior?.receita > 0
    ? ((Number(atual.receita || 0) - Number(resumo.anterior.receita)) / Number(resumo.anterior.receita)) * 100
    : null;

  return (
    <div>
      <PageHeader
        title={t('financial.title') || 'Financeiro'}
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
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Presets */}
        <div className="flex gap-0.5 bg-n-100 rounded-sm p-0.5">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => selectPreset(i)}
              className={`px-3 py-1.5 rounded-xs text-xs font-body font-semibold transition-colors whitespace-nowrap ${presetAtivo === i ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Granularidade */}
        <div className="flex gap-0.5 bg-n-100 rounded-sm p-0.5">
          {GRANULARIDADES.map(g => (
            <button key={g.value} onClick={() => setGran(g.value)}
              className={`px-3 py-1.5 rounded-xs text-xs font-body font-semibold transition-colors ${granularidade === g.value ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {g.label}
            </button>
          ))}
        </div>

        {/* CVE/EUR toggle */}
        <div className="flex gap-0.5 bg-n-100 rounded-sm p-0.5 ml-auto">
          {['EUR', 'CVE'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 rounded-xs text-xs font-mono font-semibold transition-colors ${currency === c ? 'bg-ocean-700 text-white shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : (
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
              label="Directas vs OTA"
              value={directas}
              sub={`${ota} via OTA`}
              icon={BarChart2}
              format="number"
            />
            <KpiCard
              label="Ticket medio"
              value={ticketMedio}
              delta={null}
              icon={Receipt}
              format="euro"
              currency={currency}
            />
            <KpiCard
              label="Crescimento"
              value={crescimento != null ? Math.abs(crescimento) : null}
              delta={crescimento}
              deltaLabel="vs mes ant."
              icon={TrendingUp}
              format="percent"
            />
          </div>

          {/* Graficos — linha + donut */}
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

          {/* Top servicos + top clientes */}
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
      )}
    </div>
  );
}
