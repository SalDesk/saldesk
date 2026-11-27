import { Edit2, Layers } from 'lucide-react';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import ServiceBarChart from '../../components/financial/ServiceBarChart';
import { IconBtn, EDIT_HOVER } from '../../components/shared/IconBtn';
import { CARTAO, CartaoFin, NUM, fmtMoney, unitTotalCost } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function PorTourTab({ unidades, currency, costs, onEditCosts }) {
  useLingua();
  const t = useT();
  if (!unidades || unidades.length === 0) return (
    <div className={CARTAO}><EmptyState icon={Layers} title={t('financial.byTour.empty')} /></div>
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
    { key: 'reservas', label: t('financial.byTour.bookings'), align: 'right', render: r => <span className={`${NUM} text-n-700`}>{r.num_reservas ?? '—'}</span> },
    { key: 'receita', label: t('financial.byTour.grossRevenue'), align: 'right', render: r => <span className={`${NUM} font-semibold text-ocean-900`}>{fmtMoney(r.receita, currency)}</span> },
    { key: 'custo', label: t('financial.byTour.cost'), align: 'right', render: r => <span className={`${NUM} text-n-700`}>{r.custo > 0 ? fmtMoney(r.custo, currency) : <span className="text-n-600 text-xs">—</span>}</span> },
    { key: 'margem', label: t('financial.byTour.margin'), align: 'right', render: r => <span className={`${NUM} font-semibold ${r.margem >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{r.custo > 0 ? fmtMoney(r.margem, currency) : '—'}</span> },
    { key: 'pct', label: '%', align: 'right', render: r => (r.margemPct != null && r.custo > 0 ? <span className={`text-xs ${NUM} font-semibold ${r.margemPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{r.margemPct.toFixed(1)}%</span> : <span className="text-n-600 text-xs">—</span>) },
    {
      key: 'acoes', label: '',
      render: r => (
        <IconBtn icon={Edit2} label={t('financial.byTour.editCosts', { name: r.unit_name || r.name })} onClick={() => onEditCosts(r.unit_id || r.id, r.unit_name || r.name)} hover={EDIT_HOVER} />
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <CartaoFin titulo={t('financial.byTour.revenueByTour')}>
        <ServiceBarChart data={unidades} currency={currency} />
      </CartaoFin>
      <CartaoFin titulo={t('financial.byTour.costsByTour')}>
        <Table columns={columns} rows={rows} compact />
      </CartaoFin>
    </div>
  );
}

export default PorTourTab;
