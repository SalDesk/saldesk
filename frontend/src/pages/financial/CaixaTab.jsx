import { Wallet } from 'lucide-react';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PS_COLOR, PS_LABEL, fmtDate, fmtMoney } from './shared';

function CaixaTab({ transacoes, currency, loading }) {
  const cash     = (transacoes || []).filter(t => t.payment_method === 'cash');
  const totalRec = cash.reduce((s, t) => s + Number(t.total_price || 0), 0);
  const pago     = cash.filter(t => t.payment_status === 'paid').reduce((s, t) => s + Number(t.total_price || 0), 0);
  const pendente = cash.filter(t => t.payment_status === 'pending').reduce((s, t) => s + Number(t.total_price || 0), 0);
  const columns = [
    { key: 'data', label: 'Data', render: t => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</span> },
    { key: 'cliente', label: 'Cliente', render: t => <span className="font-body text-n-800 whitespace-nowrap">{t.customer_name || '—'}</span> },
    { key: 'servico', label: 'Servico', render: t => <span className="block max-w-[160px] truncate font-body text-n-700">{t.units?.name || '—'}</span> },
    { key: 'montante', label: 'Montante', render: t => <span className="font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_price, currency)}</span> },
    { key: 'estado', label: 'Estado', render: t => <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>{PS_LABEL[t.payment_status] || t.payment_status || '—'}</span> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total recebido', value: fmtMoney(totalRec, currency), cls: 'text-n-900' }, { label: 'Confirmado', value: fmtMoney(pago, currency), cls: 'text-[var(--success)]' }, { label: 'Por confirmar', value: fmtMoney(pendente, currency), cls: 'text-[var(--warning)]' }].map(m => (
          <Card key={m.label} padding="px-5 py-4"><p className={`font-display font-bold text-xl ${m.cls}`}>{m.value}</p><p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p></Card>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       cash.length === 0 ? <Card padding="p-0"><EmptyState icon={Wallet} title="Sem pagamentos em dinheiro no periodo." /></Card> :
       <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Pagamentos em dinheiro</h3>}>
         <Table columns={columns} rows={cash} compact />
       </Card>}
    </div>
  );
}

export default CaixaTab;
