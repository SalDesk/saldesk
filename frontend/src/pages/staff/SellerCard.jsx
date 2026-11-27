import { useState, useEffect } from 'react';
import { listSellerCommissions, markCommissionPaid } from '../../services/sellerService';
import Badge from '../../components/ui/Badge';
import { StaffAvatar, rotuloZona } from './shared';
import { useT } from '../../i18n';
import { useLingua } from '../../utils/formatoLingua';

/* Estilo Mare: cartao de pagina, caixa interior calma e figuras em mono */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const CAIXA = 'bg-mare-head rounded-[14px] px-3 py-2.5';
const NUM = 'font-mono tabular-nums';

/* Cartao de um Vendedor de Praia com as comissoes do mes (total e por pagar).
   As comissoes sao pedidas UMA vez por vendedor (antes pedia-se a cada render e o resultado, uma
   promessa, era lido como lista: os totais ficavam sempre a zero e "Registar pagamento" nunca aparecia). */
export default function SellerCard({ seller }) {
  const t = useT();
  const lang = useLingua();
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
    if (!window.confirm(t('staff.seller.confirmPay', { amount: Math.round(totalPending), name: seller.name }))) return;
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
    <article className={CARTAO}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <StaffAvatar member={seller} size={40} />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-ocean-900 break-words">{seller.name}</p>
              <p className="text-sm font-body text-n-600 break-words">{rotuloZona(seller.seller_zone, t, lang) || t('staff.seller.noZone')}</p>
            </div>
          </div>
          <span className="shrink-0"><Badge variant="direct">{t('staff.card.sellerBadge')}</Badge></span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={CAIXA}>
            <p className={`font-display font-bold text-base text-ocean-900 ${NUM}`}>€{Math.round(totalMonth)}</p>
            <p className="text-xs font-body text-n-600">{t('staff.seller.commissionsMonth')}</p>
          </div>
          <div className="bg-sand-50 rounded-[14px] px-3 py-2.5">
            <p className={`font-display font-bold text-base text-ocean-900 ${NUM}`}>€{Math.round(totalPending)}</p>
            <p className="text-xs font-body text-n-600">{t('staff.seller.unpaid')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-body text-n-600 pt-3 border-t border-n-100">
          <span className={NUM}>{t('staff.seller.commissionPct', { pct: seller.commission_pct || 10 })}</span>
          {totalPending > 0 && (
            <button
              type="button"
              disabled={paying}
              onClick={handlePay}
              className="min-h-11 md:min-h-0 text-sm font-body font-semibold text-ocean-700 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 disabled:opacity-50">
              {t('staff.seller.recordPayment')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
