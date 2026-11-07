import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import Table from '../../components/ui/Table';
import { fmtMoney } from './shared';

function Comparativo({ resumo, currency }) {
  if (!resumo?.variacao || !resumo?.atual || !resumo?.anterior) return null;
  const { atual, anterior, variacao } = resumo;
  const rows = [
    { id: 'receita',  label: 'Receita',  atual: atual.receita,       ant: anterior.receita,       fmt: 'euro', delta: variacao.receita },
    { id: 'reservas', label: 'Reservas', atual: atual.num_reservas,  ant: anterior.num_reservas,  fmt: 'num',  delta: variacao.num_reservas },
    { id: 'ocupacao', label: 'Ocupacao', atual: atual.taxa_ocupacao, ant: anterior.taxa_ocupacao, fmt: 'pct',  delta: variacao.taxa_ocupacao },
  ];
  function fmt(v, f) {
    if (f === 'euro') return fmtMoney(v, currency);
    if (f === 'pct')  return `${Number(v || 0).toFixed(1)}%`;
    return String(v ?? 0);
  }
  const columns = [
    { key: 'label', label: 'Metrica', render: r => <span className="font-body font-semibold text-n-800">{r.label}</span> },
    { key: 'atual', label: 'Periodo actual', align: 'right', render: r => <span className="font-display font-bold text-ocean-700">{fmt(r.atual, r.fmt)}</span> },
    { key: 'ant', label: 'Periodo anterior', align: 'right', render: r => <span className="font-body text-n-500">{fmt(r.ant, r.fmt)}</span> },
    {
      key: 'delta', label: 'Variacao', align: 'right',
      render: r => {
        const up = r.delta > 0, neutral = r.delta === 0 || r.delta == null;
        const Icon = neutral ? Minus : up ? ArrowUpRight : ArrowDownRight;
        const color = neutral ? 'text-n-400' : up ? 'text-[var(--success)]' : 'text-[var(--error)]';
        return (
          <span className={`flex items-center justify-end gap-1 text-xs font-body ${color}`}>
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
