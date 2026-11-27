import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import Table from '../../components/ui/Table';
import { NUM, fmtMoney } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function Comparativo({ resumo, currency }) {
  useLingua();
  const t = useT();
  if (!resumo?.variacao || !resumo?.atual || !resumo?.anterior) return null;
  const { atual, anterior, variacao } = resumo;
  const rows = [
    { id: 'receita',  label: t('financial.comparison.revenue'),   atual: atual.receita,       ant: anterior.receita,       fmt: 'euro', delta: variacao.receita },
    { id: 'reservas', label: t('financial.comparison.bookings'),  atual: atual.num_reservas,  ant: anterior.num_reservas,  fmt: 'num',  delta: variacao.num_reservas },
    { id: 'ocupacao', label: t('financial.comparison.occupancy'), atual: atual.taxa_ocupacao, ant: anterior.taxa_ocupacao, fmt: 'pct',  delta: variacao.taxa_ocupacao },
  ];
  function fmt(v, f) {
    if (f === 'euro') return fmtMoney(v, currency);
    if (f === 'pct')  return `${Number(v || 0).toFixed(1)}%`;
    return String(v ?? 0);
  }
  const columns = [
    { key: 'label', label: t('financial.comparison.metric'), render: r => <span className="font-body font-semibold text-n-800">{r.label}</span> },
    { key: 'atual', label: t('financial.comparison.current'), align: 'right', render: r => <span className={`${NUM} font-semibold text-ocean-900`}>{fmt(r.atual, r.fmt)}</span> },
    { key: 'ant', label: t('financial.comparison.previous'), align: 'right', render: r => <span className={`${NUM} text-n-600`}>{fmt(r.ant, r.fmt)}</span> },
    {
      key: 'delta', label: t('financial.comparison.change'), align: 'right',
      render: r => {
        const up = r.delta > 0, neutral = r.delta === 0 || r.delta == null;
        const Icon = neutral ? Minus : up ? ArrowUpRight : ArrowDownRight;
        const color = neutral ? 'text-n-600' : up ? 'text-[var(--success)]' : 'text-[var(--error)]';
        return (
          <span className={`flex items-center justify-end gap-1 text-xs ${NUM} ${color}`}>
            <Icon size={12} strokeWidth={2} />
            {neutral ? '—' : `${up ? '+' : ''}${r.fmt === 'pct' ? `${Number(r.delta).toFixed(1)} p.p.` : r.fmt === 'euro' ? fmtMoney(r.delta, currency) : r.delta}`}
          </span>
        );
      },
    },
  ];
  return <Table columns={columns} rows={rows} />;
}

export default Comparativo;
