import { useState } from 'react';
import { Receipt } from 'lucide-react';
import Table from '../../components/ui/Table';
import Input, { Select } from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
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
  const columns = [
    { key: 'data', label: 'Data', render: t => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</span> },
    { key: 'cliente', label: 'Cliente', render: t => <span className="font-body text-n-800 whitespace-nowrap">{t.customer_name || '—'}</span> },
    { key: 'servico', label: 'Servico', render: t => <span className="block max-w-[140px] truncate font-body text-n-700">{t.units?.name || '—'}</span> },
    { key: 'canal', label: 'Canal', render: t => <span className="text-xs font-mono text-n-500">{SRC_LABEL[t.source] || t.source || '—'}</span> },
    { key: 'metodo', label: 'Metodo', render: t => <span className="text-xs font-body text-n-600">{PM_LABEL[t.payment_method] || t.payment_method || '—'}</span> },
    { key: 'montante', label: 'Montante', render: t => <span className="font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_price, currency)}</span> },
    { key: 'estado', label: 'Estado', render: t => <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>{PS_LABEL[t.payment_status] || t.payment_status || '—'}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="w-48">
          <Input aria-label="Pesquisar transacoes" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." />
        </div>
        <div className="w-44">
          <Select aria-label="Metodo de pagamento" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m === 'Todos' ? 'Todos os metodos' : PM_LABEL[m] || m}</option>)}
          </Select>
        </div>
        <div className="w-44">
          <Select aria-label="Estado do pagamento" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            {PAYMENT_STATUS.map(s => <option key={s} value={s}>{s === 'Todos' ? 'Todos os estados' : PS_LABEL[s] || s}</option>)}
          </Select>
        </div>
        <span className="text-xs font-body text-n-400 ml-1">{rows.length} transacao(oes)</span>
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       rows.length === 0 ? (
        <EmptyState icon={Receipt} title="Sem transacoes no periodo" />
      ) : (
        <Table columns={columns} rows={rows.slice(0, 50)} compact />
      )}
    </div>
  );
}

export default TransacoesTable;
