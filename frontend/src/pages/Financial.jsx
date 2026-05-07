import { useState, useEffect, useCallback } from 'react';
import { Euro, BarChart2, BookOpen, TrendingUp, Download, FileSpreadsheet, PiggyBank } from 'lucide-react';
import { getResumo, getReceita, getUnidades, getTopClientes, getCanais, exportExcel } from '../services/financeiroService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import KpiCard from '../components/financial/KpiCard';
import RevenueChart from '../components/financial/RevenueChart';
import ChannelChart from '../components/financial/ChannelChart';
import UnitTable from '../components/financial/UnitTable';
import TopCustomersList from '../components/financial/TopCustomersList';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ─── Helpers de periodo ─── */
function mesAtual() {
  const n = new Date(), y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0');
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${new Date(y, n.getMonth() + 1, 0).getDate()}` };
}
function mesAnterior() {
  const n = new Date(), mo = n.getMonth() === 0 ? 11 : n.getMonth() - 1;
  const y = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
  const ms = String(mo + 1).padStart(2, '0');
  return { inicio: `${y}-${ms}-01`, fim: `${y}-${ms}-${new Date(y, mo + 1, 0).getDate()}` };
}
function esteAno() {
  const y = new Date().getFullYear();
  return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
}

const PRESETS = [
  { label: 'Este mes',     fn: mesAtual },
  { label: 'Mes anterior', fn: mesAnterior },
  { label: 'Este ano',     fn: esteAno },
];

const GRANULARIDADES = [
  { value: 'day',   label: 'Dia' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

export default function Financial() {
  const t = useT();
  const [periodo, setPeriodo] = useState(mesAtual());
  const [presetAtivo, setPresetAtivo] = useState(0);
  const [granularidade, setGranularidade] = useState('week');
  const [exporting, setExporting] = useState(false);

  const [resumo,    setResumo]    = useState(null);
  const [receita,   setReceita]   = useState([]);
  const [unidades,  setUnidades]  = useState([]);
  const [clientes,  setClientes]  = useState([]);
  const [canais,    setCanais]    = useState([]);
  const [loading,   setLoading]   = useState(true);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(periodo, granularidade); }, [periodo, granularidade]);

  function selectPreset(i) {
    const p = PRESETS[i].fn();
    setPresetAtivo(i);
    setPeriodo(p);
  }

  async function handleExport() {
    setExporting(true);
    try { await exportExcel(periodo.inicio, periodo.fim); }
    finally { setExporting(false); }
  }

  const v = resumo?.variacao;
  const atual = resumo?.atual;

  return (
    <div>
      <PageHeader
        title={t('financial.title')}
        actions={
          <Button variant="secondary" icon={FileSpreadsheet} loading={exporting} onClick={handleExport}>
            {t('financial.exportExcel')}
          </Button>
        }
      />

      {/* Barra de controlo */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Presets */}
        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => selectPreset(i)}
              className={`px-3 py-1.5 rounded-xs text-xs font-body font-semibold transition-colors ${presetAtivo === i ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Granularidade */}
        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {GRANULARIDADES.map((g) => (
            <button
              key={g.value}
              onClick={() => setGranularidade(g.value)}
              className={`px-3 py-1.5 rounded-xs text-xs font-body font-semibold transition-colors ${granularidade === g.value ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <span className="text-xs font-body text-n-400 ml-1">
          {periodo.inicio} — {periodo.fim}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t('financial.revenue')}
              value={atual?.receita}
              delta={v?.receita}
              deltaLabel="vs periodo ant."
              icon={Euro}
              format="euro"
            />
            <KpiCard
              label={t('financial.occupancy')}
              value={atual?.taxa_ocupacao}
              delta={v?.taxa_ocupacao}
              deltaLabel="p.p."
              icon={BarChart2}
              format="percent"
            />
            <KpiCard
              label={t('dashboard.reservations')}
              value={atual?.num_reservas}
              delta={v?.num_reservas}
              deltaLabel="vs periodo ant."
              icon={BookOpen}
            />
            <KpiCard
              label={t('financial.commissionsSaved')}
              value={resumo?.poupanca_comissoes}
              icon={PiggyBank}
              format="euro"
            />
          </div>

          {/* Graficos principais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card
              className="lg:col-span-2"
              header={
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-sm text-n-700">{t('financial.revenue')}</h3>
                </div>
              }
              padding="px-5 pb-5 pt-2"
            >
              <RevenueChart data={receita} granularidade={granularidade} />
            </Card>

            <Card
              header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.byChannel')}</h3>}
              padding="px-5 pb-5 pt-2"
            >
              <ChannelChart data={canais} />
            </Card>
          </div>

          {/* Unidades + Top clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.byUnit')}</h3>}>
              <UnitTable data={unidades} />
            </Card>

            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Top Clientes</h3>}>
              <TopCustomersList data={clientes} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
