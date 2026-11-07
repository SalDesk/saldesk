import { useState, useEffect, useCallback } from 'react';
import {
  Euro,
  BarChart2,
  TrendingUp,
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
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import FilterChips from '../components/ui/FilterChips';
import KpiCard from '../components/financial/KpiCard';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import ServiceBarChart from '../components/financial/ServiceBarChart';
import TopCustomersList from '../components/financial/TopCustomersList';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { mesAtual, mesAnterior, esteAno, ultimos30, loadCosts, saveCosts, unitTotalCost } from './financial/shared';
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
const SECTIONS = [
  { id: 'receitas',   label: 'Receitas',   pro: false },
  { id: 'despesas',   label: 'Despesas',   pro: true  },
  { id: 'salarios',   label: 'Salarios',   pro: true  },
  { id: 'comissoes',  label: 'Comissoes',  pro: false },
  { id: 'obrigacoes', label: 'Obrigacoes', pro: true  },
  { id: 'resultado',  label: 'Resultado',  pro: true  },
];

const RECEITAS_TABS = [
  { id: 'geral',    label: 'Visao Geral' },
  { id: 'portour',  label: 'Por Tour' },
  { id: 'previsao', label: 'Previsao' },
  { id: 'caixa',    label: 'Caixa' },
  { id: 'manuais',  label: 'Receitas Manuais' },
];

const PRESETS = [
  { label: 'Ultimos 30 dias', fn: ultimos30 },
  { label: 'Este mes',        fn: mesAtual },
  { label: 'Mes anterior',    fn: mesAnterior },
  { label: 'Este ano',        fn: esteAno },
];
const MOEDAS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'CVE', label: 'CVE' },
];
const GRANULARIDADES = [
  { value: 'day',   label: 'Dia' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

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
      <div className="mb-5">
        <Tabs
          tabs={SECTIONS.map(({ id, label, pro }) => ({
            id,
            label: pro && !canAccess('financeiro-completo')
              ? <span className="inline-flex items-center gap-1.5">{label}<Lock size={11} strokeWidth={1.75} className="text-n-300 shrink-0" /></span>
              : label,
          }))}
          value={activeSec}
          onChange={setActiveSec}
        />
      </div>

      {/* ── RECEITAS section ── */}
      {activeSec === 'receitas' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <FilterChips options={PRESETS.map((p, i) => ({ value: i, label: p.label }))} value={presetAtivo} onChange={selectPreset} />
            <FilterChips options={GRANULARIDADES} value={granularidade} onChange={setGran} />
            <div className="ml-auto">
              <FilterChips options={MOEDAS} value={currency} onChange={setCurrency} />
            </div>
          </div>

          {/* Receitas sub-tabs */}
          <div className="mb-5">
            <Tabs tabs={RECEITAS_TABS} value={activeTab} onChange={setActiveTab} />
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
          ) : activeTab === 'manuais' ? (
            <ReceitasManuaisTab currency={currency} onChange={refreshAposReceitaManual} />
          ) : null}
        </>
      )}

      {activeSec === 'despesas'   && <PlanGuard plan="pro" feature="financeiro-completo"><DespesasTab   currency={currency} staff={staff} /></PlanGuard>}
      {activeSec === 'salarios'   && <PlanGuard plan="pro" feature="financeiro-completo"><SalariosTab   currency={currency} /></PlanGuard>}
      {activeSec === 'comissoes'  && <ComissoesTab  currency={currency} />}
      {activeSec === 'obrigacoes' && <PlanGuard plan="pro" feature="financeiro-completo"><ObrigacoesTab currency={currency} /></PlanGuard>}
      {activeSec === 'resultado'  && <PlanGuard plan="pro" feature="financeiro-completo"><ResultadoTab  resumo={resumo} currency={currency} sazonal={sazonal} periodo={periodo} /></PlanGuard>}

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
