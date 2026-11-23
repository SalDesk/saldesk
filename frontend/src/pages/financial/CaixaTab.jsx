import { Wallet } from 'lucide-react';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PS_COLOR, rotuloEstadoPagamento, fmtDate, fmtMoney } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function CaixaTab({ transacoes, currency, loading }) {
  useLingua();
  const t = useT();
  const cash     = (transacoes || []).filter(tx => tx.payment_method === 'cash');
  const totalRec = cash.reduce((s, tx) => s + Number(tx.total_price || 0), 0);
  const pago     = cash.filter(tx => tx.payment_status === 'paid').reduce((s, tx) => s + Number(tx.total_price || 0), 0);
  const pendente = cash.filter(tx => tx.payment_status === 'pending').reduce((s, tx) => s + Number(tx.total_price || 0), 0);
  const columns = [
    { key: 'data', label: t('financial.columns.date'), render: tx => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(tx.check_in)}</span> },
    { key: 'cliente', label: t('financial.columns.customer'), render: tx => <span className="font-body text-n-800 whitespace-nowrap">{tx.customer_name || '—'}</span> },
    { key: 'servico', label: t('financial.columns.service'), render: tx => <span className="block max-w-[160px] truncate font-body text-n-700">{tx.units?.name || '—'}</span> },
    { key: 'montante', label: t('financial.columns.amount'), render: tx => <span className="font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(tx.total_price, currency)}</span> },
    { key: 'estado', label: t('financial.columns.status'), render: tx => <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs ${PS_COLOR[tx.payment_status] || 'text-n-500 bg-n-100'}`}>{rotuloEstadoPagamento(tx.payment_status, t)}</span> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[{ label: t('financial.cash.totalReceived'), value: fmtMoney(totalRec, currency), cls: 'text-n-900' }, { label: t('financial.cash.confirmed'), value: fmtMoney(pago, currency), cls: 'text-[var(--success)]' }, { label: t('financial.cash.toConfirm'), value: fmtMoney(pendente, currency), cls: 'text-[var(--warning)]' }].map(m => (
          <Card key={m.label} padding="px-5 py-4"><p className={`font-display font-bold text-xl ${m.cls}`}>{m.value}</p><p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p></Card>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       cash.length === 0 ? <Card padding="p-0"><EmptyState icon={Wallet} title={t('financial.cash.empty')} /></Card> :
       <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.cash.title')}</h3>}>
         <Table columns={columns} rows={cash} compact />
       </Card>}
    </div>
  );
}

export default CaixaTab;
