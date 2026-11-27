import { useState, useEffect } from 'react';
import {
  Users,
  Check,
} from 'lucide-react';
import { listSellerCommissions, markCommissionPaid as markCommPaid, getSellerCommissionPct } from '../../services/sellerService';
import { listStaff } from '../../services/staffService';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { CARTAO, CAIXA, NUM, fmtMoney } from './shared';
import { CARGO_VENDEDOR } from '../staff/shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

/* ─────────────────── COMISSOES VENDEDORES ─────────────────── */

function ComissoesTab({ currency }) {
  useLingua();
  const t = useT();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellerComms, setSellerComms] = useState({});
  const [payModal, setPayModal] = useState(null);
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true);
    listStaff()
      .then(async d => {
        const v = (d || []).filter(s => s.role === CARGO_VENDEDOR && s.status === 'active');
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
    <div className={CARTAO}><EmptyState icon={Users} title={t('financial.commissions.empty')} description={t('financial.commissions.emptyHint')} /></div>
  );

  return (
    <div className="space-y-3">
      {sellers.map(s => {
        const comms   = getMonthComms(s.id);
        const total   = comms.reduce((sum, c) => sum + c.amount, 0);
        const paid    = comms.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
        const pending = total - paid;
        return (
          <section key={s.id} className={CARTAO}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-base text-ocean-900 break-words">{s.name}</p>
                <p className="text-xs font-body text-n-600">{t('financial.commissions.summary', { pct: s.commission_pct ?? getSellerCommissionPct(s.id, 10), n: comms.length })}</p>
              </div>
              <div className="flex flex-wrap gap-4">
                {[{l: t('financial.commissions.total'), v: fmtMoney(total, currency), c: 'text-n-800'}, {l: t('financial.paymentStatus.paid'), v: fmtMoney(paid, currency), c: 'text-[var(--success)]'}, {l: t('financial.paymentStatus.pending'), v: fmtMoney(pending, currency), c: 'text-[var(--warning)]'}].map(m => (
                  <div key={m.l} className="text-center"><p className={`${NUM} font-bold text-sm ${m.c}`}>{m.v}</p><p className="text-xs font-body text-n-600">{m.l}</p></div>
                ))}
              </div>
              {pending > 0 && <Button size="sm" variant="secondary" className="min-h-11 md:min-h-0" onClick={() => setPayModal({ seller: s, pending })}>{t('financial.commissions.recordPayment')}</Button>}
            </div>
            {comms.length > 0 && (
              <div className={`${CAIXA} mt-3 p-3 space-y-1.5`}>
                {comms.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-body text-n-700 truncate min-w-0">{c.reservations?.units?.name || c.reservations?.customer_name || '—'}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`${NUM} font-semibold text-[var(--success)]`}>{fmtMoney(c.amount, currency)}</span>
                      <Badge variant={c.status === 'paid' ? 'confirmed' : 'pending'}>{c.status === 'paid' ? t('financial.paymentStatus.paid') : t('financial.paymentStatus.pending')}</Badge>
                      {c.status === 'pending' && <button type="button" aria-label={t('financial.commissions.payAria', { name: c.reservations?.units?.name || c.reservations?.customer_name || '—' })} onClick={() => handlePay(s.id, c.id)} className="inline-flex items-center justify-center min-h-11 md:min-h-9 px-3 rounded-full font-semibold text-ocean-700 hover:bg-ocean-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500">{t('financial.commissions.pay')}</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={t('financial.commissions.payTitle', { name: payModal.seller.name })} size="sm">
          <div className="space-y-4">
            <div className="px-3 py-2 bg-[var(--warning-light)] border border-[var(--warning)] rounded-[14px]"><p className="text-xs font-body text-[var(--warning)]">{t('financial.commissions.pendingThisMonth')}<span className={`${NUM} font-bold`}>{fmtMoney(payModal.pending, currency)}</span></p></div>
            <p className="text-xs font-body text-n-600">{t('financial.commissions.explain')}</p>
            <div className="flex gap-3"><Button variant="secondary" onClick={() => setPayModal(null)} className="flex-1">{t('common.cancel')}</Button><Button icon={Check} onClick={() => { const comms = getMonthComms(payModal.seller.id).filter(c => c.status === 'pending'); comms.forEach(c => handlePay(payModal.seller.id, c.id)); }} className="flex-1">{t('financial.confirmPayment')}</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ComissoesTab;
