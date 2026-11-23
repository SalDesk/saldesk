import { useState } from 'react';
import { Receipt } from 'lucide-react';
import Table from '../../components/ui/Table';
import Input, { Select } from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PAYMENT_METHODS, PAYMENT_STATUS, PS_COLOR, rotuloMetodo, rotuloEstadoPagamento, rotuloCanal, fmtDate, fmtMoney } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function TransacoesTable({ transacoes, currency, loading }) {
  useLingua();
  const t = useT();
  const [filterMethod, setFilterMethod] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [search, setSearch] = useState('');
  const rows = (transacoes || []).filter(tx => {
    if (filterMethod !== 'Todos' && tx.payment_method !== filterMethod) return false;
    if (filterStatus !== 'Todos' && tx.payment_status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (tx.customer_name || '').toLowerCase();
      if (!name.includes(q) && !(tx.units?.name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const columns = [
    { key: 'data', label: t('financial.columns.date'), render: tx => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(tx.check_in)}</span> },
    { key: 'cliente', label: t('financial.columns.customer'), render: tx => <span className="font-body text-n-800 whitespace-nowrap">{tx.customer_name || '—'}</span> },
    { key: 'servico', label: t('financial.columns.service'), render: tx => <span className="block max-w-[140px] truncate font-body text-n-700">{tx.units?.name || '—'}</span> },
    { key: 'canal', label: t('financial.columns.channel'), render: tx => <span className="text-xs font-mono text-n-500">{rotuloCanal(tx.source, t)}</span> },
    { key: 'metodo', label: t('financial.columns.method'), render: tx => <span className="text-xs font-body text-n-600">{rotuloMetodo(tx.payment_method, t)}</span> },
    { key: 'montante', label: t('financial.columns.amount'), render: tx => <span className="font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(tx.total_price, currency)}</span> },
    { key: 'estado', label: t('financial.columns.status'), render: tx => <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs ${PS_COLOR[tx.payment_status] || 'text-n-500 bg-n-100'}`}>{rotuloEstadoPagamento(tx.payment_status, t)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="w-48">
          <Input aria-label={t('financial.transactions.searchAria')} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('financial.transactions.searchPlaceholder')} />
        </div>
        <div className="w-44">
          <Select aria-label={t('financial.transactions.methodAria')} value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m === 'Todos' ? t('financial.transactions.allMethods') : rotuloMetodo(m, t)}</option>)}
          </Select>
        </div>
        <div className="w-44">
          <Select aria-label={t('financial.transactions.statusAria')} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            {PAYMENT_STATUS.map(s => <option key={s} value={s}>{s === 'Todos' ? t('financial.transactions.allStatuses') : rotuloEstadoPagamento(s, t)}</option>)}
          </Select>
        </div>
        <span className="text-xs font-body text-n-400 ml-1">{t('financial.transactions.count', { n: rows.length })}</span>
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       rows.length === 0 ? (
        <EmptyState icon={Receipt} title={t('financial.transactions.empty')} />
      ) : (
        <Table columns={columns} rows={rows.slice(0, 50)} compact />
      )}
    </div>
  );
}

export default TransacoesTable;
