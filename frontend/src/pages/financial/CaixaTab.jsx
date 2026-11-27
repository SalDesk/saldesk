import { Wallet } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import MareStat from '../../components/shared/MareStat';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PS_VARIANT, CARTAO, CartaoFin, NUM, rotuloEstadoPagamento, fmtDate, fmtMoney } from './shared';
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
    { key: 'data', label: t('financial.columns.date'), render: tx => <span className={`text-xs ${NUM} text-n-600 whitespace-nowrap`}>{fmtDate(tx.check_in)}</span> },
    { key: 'cliente', label: t('financial.columns.customer'), render: tx => <span className="font-body text-n-800 whitespace-nowrap">{tx.customer_name || '—'}</span> },
    { key: 'servico', label: t('financial.columns.service'), render: tx => <span className="block max-w-[160px] truncate font-body text-n-700">{tx.units?.name || '—'}</span> },
    { key: 'montante', label: t('financial.columns.amount'), render: tx => <span className={`${NUM} font-semibold text-ocean-900 whitespace-nowrap`}>{fmtMoney(tx.total_price, currency)}</span> },
    { key: 'estado', label: t('financial.columns.status'), render: tx => <Badge variant={PS_VARIANT[tx.payment_status] || 'default'}>{rotuloEstadoPagamento(tx.payment_status, t)}</Badge> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MareStat label={t('financial.cash.totalReceived')} value={fmtMoney(totalRec, currency)} />
        <MareStat label={t('financial.cash.confirmed')} value={fmtMoney(pago, currency)} tone="bom" />
        <MareStat label={t('financial.cash.toConfirm')} value={fmtMoney(pendente, currency)} tone="aviso" />
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       cash.length === 0 ? <div className={CARTAO}><EmptyState icon={Wallet} title={t('financial.cash.empty')} /></div> :
       <CartaoFin titulo={t('financial.cash.title')}>
         <Table columns={columns} rows={cash} compact />
       </CartaoFin>}
    </div>
  );
}

export default CaixaTab;
