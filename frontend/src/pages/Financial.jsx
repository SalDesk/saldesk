import { useState, useEffect, useCallback } from 'react';
import {
  Euro,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
  FileSpreadsheet,
  FileText,
  Receipt,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { getResumo, getReceita, getUnidades, getTopClientes, getCanais, exportExcel, getTransacoes, exportPdf, getForecast } from '../services/financeiroService';
import { listStaff } from '../services/staffService';
import usePlan from '../hooks/usePlan';
import { useT } from '../i18n';
import PlanGuard from '../components/PlanGuard';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import FilterChips from '../components/ui/FilterChips';
import MareStat from '../components/shared/MareStat';
import { IconBtn, EDIT_HOVER } from '../components/shared/IconBtn';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import TopCustomersList from '../components/financial/TopCustomersList';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { mesAtual, mesAnterior, esteAno, ultimos30, loadCosts, saveCosts, unitTotalCost, fmtMoney, fmtMoneyOuTraco, CartaoFin, NUM } from './financial/shared';
import CostEditModal from './financial/CostEditModal';
import TransacoesTable from './financial/TransacoesTable';
import Comparativo from './financial/Comparativo';
import PorTourTab from './financial/PorTourTab';
import PrevisaoTab from './financial/PrevisaoTab';
import CaixaTab from './financial/CaixaTab';
import DespesasTab from './financial/DespesasTab';
import ReceitasManuaisTab from './financial/ReceitasManuaisTab';
import SalariosTab from './financial/SalariosTab';
import ComissoesTab from './financial/ComissoesTab';
import ObrigacoesTab from './financial/ObrigacoesTab';
import ResultadoTab from './financial/ResultadoTab';

/* ── constants ── */
/* Os rotulos vem de financial.sections.<id>, financial.revenueTabs.<id>, financial.presets.<chave> e
   financial.granularity.<valor>; os ids e os valores nao mudam com a lingua */
const SECTIONS = [
  { id: 'receitas',   pro: false },
  { id: 'despesas',   pro: true  },
  { id: 'salarios',   pro: true  },
  { id: 'comissoes',  pro: false },
  { id: 'obrigacoes', pro: true  },
  { id: 'resultado',  pro: true  },
];

const RECEITAS_TABS = ['geral', 'portour', 'previsao', 'caixa', 'manuais'];

const PRESETS = [
  { chave: 'last30',    fn: ultimos30 },
  { chave: 'thisMonth', fn: mesAtual },
  { chave: 'lastMonth', fn: mesAnterior },
  { chave: 'thisYear',  fn: esteAno },
];
const MOEDAS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'CVE', label: 'CVE' },
];
const GRANULARIDADES = ['day', 'week', 'month'];

/* Variacao face ao periodo anterior: icone, sinal e valor (nunca so a cor); o delta e em euro, como sempre */
function variacaoEuro(delta, currency) {
  if (currency === 'CVE') return `${delta > 0 ? '+' : ''}${fmtMoney(delta, currency)}`;
  const n = Math.round(Number(delta || 0));
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmtMoney(Math.abs(n), currency)}`;
}
function Variacao({ delta, rotulo, currency }) {
  if (delta == null) return null;
  const neutro = delta === 0;
  const Icone = neutro ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const cor = neutro ? 'text-n-600' : delta > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]';
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 ${NUM} ${cor}`}><Icone size={12} strokeWidth={2} />{variacaoEuro(delta, currency)}</span>
      {rotulo && <span className="font-body text-n-600">{rotulo}</span>}
    </span>
  );
}

/* ─────────────────── MAIN ─────────────────── */
export default function Financial() {
  const t = useT();
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

  const carregarSazonal = useCallback(() => {
    const y = new Date().getFullYear();
    getReceita(`${y}-01-01`, `${y}-12-31`, 'month').then(d => setSazonal(d || [])).catch(() => {});
  }, []);

  useEffect(() => { carregarSazonal(); }, [carregarSazonal]);

  /* Receitas manuais alteram resumo()/receita() no backend -- este tab
     re-carrega os dados da Visao Geral depois de qualquer CRUD, senao os
     KPIs/graficos ficavam presos ao valor do carregamento inicial. */
  function refreshAposReceitaManual() {
    carregar(periodo, granularidade);
    carregarSazonal();
  }

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
        title={t('financial.title')}
        eyebrow={t('nav.sections.gestao')}
        actions={
          activeSec === 'receitas' ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={FileSpreadsheet} size="sm" className="min-h-11 md:min-h-0" loading={exporting === 'excel'} onClick={() => handleExport('excel')}>Excel</Button>
              <Button variant="secondary" icon={FileText} size="sm" className="min-h-11 md:min-h-0" loading={exporting === 'pdf'} onClick={() => handleExport('pdf')}>PDF</Button>
            </div>
          ) : null
        }
      />

      {/* Section tabs (top level) */}
      <div className="mb-5 max-w-full overflow-x-auto">
        <Tabs
          tabs={SECTIONS.map(({ id, pro }) => {
            const label = t(`financial.sections.${id}`);
            return {
              id,
              label: pro && !canAccess('financeiro-completo')
                ? <span className="inline-flex items-center gap-1.5">{label}<Lock size={11} strokeWidth={1.75} className="text-n-500 shrink-0" /></span>
                : label,
            };
          })}
          value={activeSec}
          onChange={setActiveSec}
        />
      </div>

      {/* ── RECEITAS section ── */}
      {activeSec === 'receitas' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <FilterChips options={PRESETS.map((p, i) => ({ value: i, label: t(`financial.presets.${p.chave}`) }))} value={presetAtivo} onChange={selectPreset} />
            <FilterChips options={GRANULARIDADES.map(g => ({ value: g, label: t(`financial.granularity.${g}`) }))} value={granularidade} onChange={setGran} />
            <div className="ml-auto">
              <FilterChips options={MOEDAS} value={currency} onChange={setCurrency} />
            </div>
          </div>

          {/* Receitas sub-tabs */}
          <div className="mb-5 max-w-full overflow-x-auto">
            <Tabs tabs={RECEITAS_TABS.map(id => ({ id, label: t(`financial.revenueTabs.${id}`) }))} value={activeTab} onChange={setActiveTab} />
          </div>

          {/* Receitas tab content */}
          {loading && activeTab === 'geral' ? (
            <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
          ) : activeTab === 'geral' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MareStat icon={Euro} label={t('financial.overview.totalRevenue')} value={fmtMoneyOuTraco(atual.receita, currency)} hint={variacao.receita != null ? <Variacao delta={variacao.receita} rotulo={t('financial.overview.vsPrevious')} currency={currency} /> : undefined} />
                <MareStat icon={BarChart2} label={t('financial.overview.direct', { pct: directaPct != null ? `${directaPct}%` : '' })} value={String(directas)} hint={ota > 0 ? t('financial.overview.viaOta', { n: ota }) : undefined} />
                <MareStat icon={Receipt} label={t('financial.overview.avgTicket')} value={fmtMoneyOuTraco(ticketMedio, currency)} />
                <MareStat icon={TrendingUp} label={t('financial.overview.netMargin', { pct: margemLiq != null && totalCustos > 0 ? ` (${((receitaNum - totalCustos) / receitaNum * 100).toFixed(0)}%)` : '' })} value={fmtMoneyOuTraco(margemLiq, currency)} hint={crescimento != null ? <Variacao delta={crescimento} rotulo={t('financial.overview.growth')} currency={currency} /> : undefined} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <CartaoFin className="lg:col-span-2" titulo={t('financial.overview.revenueByPeriod')} lado={<span className={`text-xs ${NUM} text-n-600`}>{periodo.inicio} — {periodo.fim}</span>}>
                  <RevenueChart data={receita} granularidade={granularidade} currency={currency} />
                </CartaoFin>
                <CartaoFin titulo={t('financial.overview.byChannel')}>
                  <ChannelChart data={canais} />
                </CartaoFin>
              </div>
              {sazonal.length > 0 && (
                <CartaoFin titulo={t('financial.overview.seasonality', { year: new Date().getFullYear() })}>
                  <RevenueChart data={sazonal} granularidade="month" currency={currency} />
                </CartaoFin>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CartaoFin titulo={t('financial.overview.topServices')}><ServiceBarChart data={unidades} currency={currency} /></CartaoFin>
                <CartaoFin titulo={t('financial.overview.topCustomers')}><TopCustomersList data={clientes} /></CartaoFin>
              </div>
              {resumo?.anterior && <CartaoFin titulo={t('financial.overview.comparison')}><Comparativo resumo={resumo} currency={currency} /></CartaoFin>}
              <CartaoFin titulo={t('financial.overview.transactions')} lado={<IconBtn icon={RefreshCw} label={t('financial.overview.refreshTransactions')} onClick={() => carregarTx(periodo)} hover={EDIT_HOVER} />}>
                <TransacoesTable transacoes={transacoes} currency={currency} loading={loadingTx} />
              </CartaoFin>
            </div>
          ) : activeTab === 'portour' ? (
            loading ? <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div> :
            <PorTourTab unidades={unidades} currency={currency} costs={costs} onEditCosts={(id, name) => setEditingUnit({ id, name })} />
          ) : activeTab === 'previsao' ? (
            <PrevisaoTab forecast={forecast} currency={currency} loading={loadingForecast} />
          ) : activeTab === 'caixa' ? (
            <CaixaTab transacoes={transacoes} currency={currency} loading={loadingTx} />
          ) : activeTab === 'manuais' ? (
            <ReceitasManuaisTab currency={currency} onChange={refreshAposReceitaManual} />
          ) : null}
        </>
      )}

      {activeSec === 'despesas'   && <PlanGuard plan="pro" feature="financeiro-completo"><DespesasTab   currency={currency} staff={staff} /></PlanGuard>}
      {activeSec === 'salarios'   && <PlanGuard plan="pro" feature="financeiro-completo"><SalariosTab   currency={currency} /></PlanGuard>}
      {activeSec === 'comissoes'  && <ComissoesTab  currency={currency} />}
      {activeSec === 'obrigacoes' && <PlanGuard plan="pro" feature="financeiro-completo"><ObrigacoesTab currency={currency} /></PlanGuard>}
      {activeSec === 'resultado'  && <PlanGuard plan="pro" feature="financeiro-completo"><ResultadoTab  resumo={resumo} currency={currency} periodo={periodo} /></PlanGuard>}

      {/* CVE/EUR toggle for non-receitas sections */}
      {activeSec !== 'receitas' && (
        <div className="fixed bottom-5 right-5 flex gap-0.5 bg-white border border-mare-card rounded-full p-1 shadow-md">
          {['EUR', 'CVE'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`min-h-11 min-w-11 md:min-h-9 px-3 rounded-full text-xs font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${currency === c ? 'bg-ocean-900 text-white' : 'text-ocean-700 hover:bg-ocean-50'}`}>
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
