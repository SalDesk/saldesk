import { useState } from 'react';
import {
  Receipt,
} from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PAYMENT_METHODS, PAYMENT_STATUS, PM_LABEL, PS_LABEL, PS_COLOR, SRC_LABEL, fmtDate, fmtMoney } from './shared';

function TransacoesTable({ transacoes, currency, loading }) {
  const [filterMethod, setFilterMethod] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [search, setSearch] = useState('');
  const rows = (transacoes || []).filter(t => {
    if (filterMethod !== 'Todos' && t.payment_method !== filterMethod) return false;
    if (filterStatus !== 'Todos' && t.payment_status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (t.customer_name || '').toLowerCase();
      if (!name.includes(q) && !(t.units?.name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..."
          className="h-8 px-3 text-sm font-body border border-n-200 rounded bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 w-48" />
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
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       rows.length === 0 ? (
        <div className="text-center py-10 text-n-400">
          <Receipt size={28} strokeWidth={1.25} className="mx-auto mb-2" />
          <p className="text-sm font-body">Sem transacoes no periodo</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-n-200">
              {['Data','Cliente','Servico','Canal','Metodo','Montante','Estado'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>{rows.slice(0, 50).map(t => (
              <tr key={t.id} className="border-b border-n-100 hover:bg-n-50 transition-colors">
                <td className="py-2.5 px-3 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</td>
                <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">{t.customer_name || '—'}</td>
                <td className="py-2.5 px-3 font-body text-n-700 max-w-[140px] truncate">{t.units?.name || '—'}</td>
                <td className="py-2.5 px-3"><span className="text-xs font-mono text-n-500">{SRC_LABEL[t.source] || t.source || '—'}</span></td>
                <td className="py-2.5 px-3"><span className="text-xs font-body text-n-600">{PM_LABEL[t.payment_method] || t.payment_method || '—'}</span></td>
                <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_price, currency)}</td>
                <td className="py-2.5 px-3"><span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>{PS_LABEL[t.payment_status] || t.payment_status || '—'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TransacoesTable;
