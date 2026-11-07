import {
  Wallet,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { PS_LABEL, PS_COLOR, fmtDate, fmtMoney } from './shared';

function CaixaTab({ transacoes, currency, loading }) {
  const cash     = (transacoes || []).filter(t => t.payment_method === 'cash');
  const totalRec = cash.reduce((s, t) => s + Number(t.total_price || 0), 0);
  const pago     = cash.filter(t => t.payment_status === 'paid').reduce((s, t) => s + Number(t.total_price || 0), 0);
  const pendente = cash.filter(t => t.payment_status === 'pending').reduce((s, t) => s + Number(t.total_price || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total recebido', value: fmtMoney(totalRec, currency), cls: 'text-n-900' }, { label: 'Confirmado', value: fmtMoney(pago, currency), cls: 'text-[#1A7A4A]' }, { label: 'Por confirmar', value: fmtMoney(pendente, currency), cls: 'text-yellow-700' }].map(m => (
          <div key={m.label} className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4"><p className={`font-display font-bold text-xl ${m.cls}`}>{m.value}</p><p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p></div>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div> :
       cash.length === 0 ? <Card><div className="text-center py-12"><Wallet size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" /><p className="font-body text-n-500">Sem pagamentos em dinheiro no periodo.</p></div></Card> :
       <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Pagamentos em dinheiro</h3>}>
         <div className="overflow-x-auto"><table className="w-full text-sm">
           <thead><tr className="border-b border-n-200">{['Data','Cliente','Servico','Montante','Estado'].map(h => <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-n-500">{h}</th>)}</tr></thead>
           <tbody>{cash.map(t => (
             <tr key={t.id} className="border-b border-n-100 hover:bg-n-50 transition-colors">
               <td className="py-2.5 px-3 text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(t.check_in)}</td>
               <td className="py-2.5 px-3 font-body text-n-800 whitespace-nowrap">{t.customer_name || '—'}</td>
               <td className="py-2.5 px-3 font-body text-n-700 max-w-[160px] truncate">{t.units?.name || '—'}</td>
               <td className="py-2.5 px-3 font-display font-bold text-ocean-700 whitespace-nowrap">{fmtMoney(t.total_price, currency)}</td>
               <td className="py-2.5 px-3"><span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PS_COLOR[t.payment_status] || 'text-n-500 bg-n-100'}`}>{PS_LABEL[t.payment_status] || t.payment_status || '—'}</span></td>
             </tr>
           ))}</tbody>
         </table></div>
       </Card>}
    </div>
  );
}

export default CaixaTab;
