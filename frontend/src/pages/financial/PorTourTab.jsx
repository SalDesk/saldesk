import { Edit2, Layers } from 'lucide-react';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import ServiceBarChart from '../../components/financial/ServiceBarChart';
import { fmtMoney, unitTotalCost } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function PorTourTab({ unidades, currency, costs, onEditCosts }) {
  useLingua();
  const t = useT();
  if (!unidades || unidades.length === 0) return (
    <Card padding="p-0"><EmptyState icon={Layers} title={t('financial.byTour.empty')} /></Card>
  );
  const rows = unidades.map(u => {
    const custo = unitTotalCost(costs[u.unit_id || u.id]);
    const receita = Number(u.receita || u.total_revenue || 0);
    return { ...u, id: u.unit_id || u.id, custo, receita, margem: receita - custo, margemPct: receita > 0 ? ((receita - custo) / receita) * 100 : null };
  });
  const maxPct = Math.max(...rows.map(r => r.margemPct ?? -Infinity));
  const minPct = Math.min(...rows.map(r => r.margemPct ?? Infinity));
  const columns = [
    {
      key: 'tour', label: t('financial.byTour.tour'),
      render: r => {
        const isBest  = r.margemPct != null && r.margemPct === maxPct && maxPct > -Infinity;
        const isWorst = r.margemPct != null && r.margemPct === minPct && minPct < Infinity && minPct !== maxPct;
        const destaque = isBest ? 'melhor' : isWorst ? 'pior' : undefined;
        const fundo = isBest ? 'rounded-xs px-1.5 py-0.5 bg-[var(--success-light)]' : isWorst ? 'rounded-xs px-1.5 py-0.5 bg-[var(--error-light)]' : '';
        return <span data-destaque={destaque} className={`inline-block max-w-[180px] truncate align-middle font-body font-semibold text-n-800 ${fundo}`}>{r.unit_name || r.name || '—'}</span>;
      },
    },
    { key: 'reservas', label: t('financial.byTour.bookings'), align: 'right', render: r => <span className="font-mono text-n-600">{r.num_reservas ?? '—'}</span> },
    { key: 'receita', label: t('financial.byTour.grossRevenue'), align: 'right', render: r => <span className="font-display font-bold text-ocean-700">{fmtMoney(r.receita, currency)}</span> },
    { key: 'custo', label: t('financial.byTour.cost'), align: 'right', render: r => <span className="font-body text-n-700">{r.custo > 0 ? fmtMoney(r.custo, currency) : <span className="text-n-400 text-xs">—</span>}</span> },
    { key: 'margem', label: t('financial.byTour.margin'), align: 'right', render: r => <span className={`font-display font-bold ${r.margem >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{r.custo > 0 ? fmtMoney(r.margem, currency) : '—'}</span> },
    { key: 'pct', label: '%', align: 'right', render: r => (r.margemPct != null && r.custo > 0 ? <span className={`text-xs font-mono font-semibold ${r.margemPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{r.margemPct.toFixed(1)}%</span> : <span className="text-n-400 text-xs">—</span>) },
    {
      key: 'acoes', label: '',
      render: r => (
        <button aria-label={t('financial.byTour.editCosts', { name: r.unit_name || r.name })} onClick={() => onEditCosts(r.unit_id || r.id, r.unit_name || r.name)} className="p-1 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.byTour.revenueByTour')}</h3>} padding="px-5 pb-5 pt-2">
        <ServiceBarChart data={unidades} currency={currency} />
      </Card>
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.byTour.costsByTour')}</h3>}>
        <Table columns={columns} rows={rows} compact />
      </Card>
    </div>
  );
}

export default PorTourTab;
