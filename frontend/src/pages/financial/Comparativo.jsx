import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { fmtMoney } from './shared';

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

export default Comparativo;
