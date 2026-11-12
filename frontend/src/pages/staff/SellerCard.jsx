import { useState, useEffect } from 'react';
import { listSellerCommissions, markCommissionPaid } from '../../services/sellerService';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { StaffAvatar } from './shared';

/* Cartao de um Vendedor de Praia com as comissoes do mes (total e por pagar).
   As comissoes sao pedidas UMA vez por vendedor (antes pedia-se a cada render e o resultado, uma
   promessa, era lido como lista: os totais ficavam sempre a zero e "Registar pagamento" nunca aparecia). */
export default function SellerCard({ seller }) {
  const [comms, setComms] = useState([]);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let vivo = true;
    listSellerCommissions(seller.id)
      .then(d => { if (vivo) setComms(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [seller.id]);

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthComms = comms.filter(c => c.created_at?.startsWith(month));
  const pendingComms = monthComms.filter(c => c.status === 'pending');
  const totalMonth   = monthComms.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalPending = pendingComms.reduce((sum, c) => sum + (c.amount || 0), 0);

  /* Paga so as pendentes do mes (as que o total mostrado e a confirmacao contam). */
  async function handlePay() {
    if (!window.confirm(`Registar pagamento de €${Math.round(totalPending)} ao vendedor ${seller.name}?`)) return;
    setPaying(true);
    try {
      const ids = pendingComms.map(c => c.id);
      await Promise.all(ids.map(id => markCommissionPaid(id)));
      setComms(prev => prev.map(c => (ids.includes(c.id) ? { ...c, status: 'paid', paid_at: new Date().toISOString() } : c)));
    } finally {
      setPaying(false);
    }
  }

  return (
    <Card padding="p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StaffAvatar member={seller} size={40} />
            <div>
              <p className="font-display font-semibold text-sm text-n-900">{seller.name}</p>
              <p className="text-xs font-body text-n-500">{seller.seller_zone || 'Sem zona definida'}</p>
            </div>
          </div>
          <Badge variant="direct">Vendedor</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-n-50 rounded-sm px-2.5 py-2">
            <p className="font-display font-bold text-sm text-ocean-700">€{Math.round(totalMonth)}</p>
            <p className="text-[10px] font-body text-n-400">Comissoes mes</p>
          </div>
          <div className="bg-[var(--warning-light)] rounded-sm px-2.5 py-2">
            <p className="font-display font-bold text-sm text-[var(--warning)]">€{Math.round(totalPending)}</p>
            <p className="text-[10px] font-body text-n-400">Por pagar</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs font-body text-n-500 pt-1 border-t border-n-100">
          <span>{seller.commission_pct || 10}% comissao</span>
          {totalPending > 0 && (
            <button
              type="button"
              disabled={paying}
              onClick={handlePay}
              className="text-xs font-body font-semibold text-ocean-700 hover:underline disabled:opacity-50">
              Registar pagamento
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
