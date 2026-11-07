import { useState, useEffect } from 'react';
import {
  Users,
  Check,
} from 'lucide-react';
import { listSellerCommissions, markCommissionPaid as markCommPaid, getSellerCommissionPct } from '../../services/sellerService';
import { listStaff } from '../../services/staffService';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { fmtMoney } from './shared';

/* ─────────────────── COMISSOES VENDEDORES ─────────────────── */

function ComissoesTab({ currency }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellerComms, setSellerComms] = useState({});
  const [payModal, setPayModal] = useState(null);
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true);
    listStaff()
      .then(async d => {
        const v = (d || []).filter(s => s.role === 'Vendedor de Praia' && s.status === 'active');
        setSellers(v);
        const entries = await Promise.all(
          v.map(async s => [s.id, await listSellerCommissions(s.id)])
        );
        setSellerComms(Object.fromEntries(entries));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getMonthComms(sellerId) {
    const all = sellerComms[sellerId];
    if (!Array.isArray(all)) return [];
    return all.filter(c => (c.created_at || '').startsWith(month));
  }

  function handlePay(sellerId, commId) {
    markCommPaid(commId);
    setSellerComms(prev => ({
      ...prev,
      [sellerId]: (prev[sellerId] || []).map(c => c.id === commId ? { ...c, status: 'paid', paid_at: new Date().toISOString() } : c),
    }));
    setPayModal(null);
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  if (sellers.length === 0) return (
    <Card padding="p-0"><EmptyState icon={Users} title="Sem vendedores de praia activos." description={'Cria colaboradores com funcao "Vendedor de Praia" na secção Colaboradores.'} /></Card>
  );

  return (
    <div className="space-y-3">
      {sellers.map(s => {
        const comms   = getMonthComms(s.id);
        const total   = comms.reduce((sum, c) => sum + c.amount, 0);
        const paid    = comms.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
        const pending = total - paid;
        return (
          <Card key={s.id} padding="px-5 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-n-900">{s.name}</p>
                <p className="text-xs font-body text-n-500">{s.commission_pct ?? getSellerCommissionPct(s.id, 10)}% comissao · {comms.length} reserva(s) este mes</p>
              </div>
              <div className="flex gap-4 shrink-0">
                {[{l: 'Total', v: fmtMoney(total, currency), c: 'text-n-800'}, {l: 'Pago', v: fmtMoney(paid, currency), c: 'text-[var(--success)]'}, {l: 'Pendente', v: fmtMoney(pending, currency), c: 'text-[var(--warning)]'}].map(m => (
                  <div key={m.l} className="text-center"><p className={`font-display font-bold text-sm ${m.c}`}>{m.v}</p><p className="text-[9px] font-mono text-n-400">{m.l}</p></div>
                ))}
              </div>
              {pending > 0 && <Button size="sm" variant="secondary" onClick={() => setPayModal({ seller: s, pending })}>Registar pag.</Button>}
            </div>
            {comms.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {comms.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="font-body text-n-600 truncate">{c.reservations?.units?.name || c.reservations?.customer_name || '—'}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-[var(--success)]">{fmtMoney(c.amount, currency)}</span>
                      <span className={`font-mono px-1.5 py-0.5 rounded-xs ${c.status === 'paid' ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--warning-light)] text-[var(--warning)]'}`}>{c.status === 'paid' ? 'Pago' : 'Pendente'}</span>
                      {c.status === 'pending' && <button aria-label={`Pagar comissao - ${c.reservations?.units?.name || c.reservations?.customer_name || '—'}`} onClick={() => handlePay(s.id, c.id)} className="text-ocean-700 hover:underline">Pagar</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={`Pagar comissoes — ${payModal.seller.name}`} size="sm">
          <div className="space-y-4">
            <div className="px-3 py-2 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm"><p className="text-xs font-body text-[var(--warning)]">Comissoes pendentes este mes: <span className="font-bold">{fmtMoney(payModal.pending, currency)}</span></p></div>
            <p className="text-xs font-body text-n-500">Esta accao marca todas as comissoes pendentes deste vendedor como pagas.</p>
            <div className="flex gap-3"><Button variant="secondary" onClick={() => setPayModal(null)} className="flex-1">Cancelar</Button><Button icon={Check} onClick={() => { const comms = getMonthComms(payModal.seller.id).filter(c => c.status === 'pending'); comms.forEach(c => handlePay(payModal.seller.id, c.id)); }} className="flex-1">Confirmar pagamento</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ComissoesTab;
