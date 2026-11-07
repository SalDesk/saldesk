import {
  Edit2,
  Layers,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import ServiceBarChart from '../../components/financial/ServiceBarChart';
import { fmtMoney, unitTotalCost } from './shared';

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

export default PorTourTab;
