import { useState, useEffect } from 'react';
import { Wallet, Landmark } from 'lucide-react';
import api from '../../services/api';
import { createSubscription, cancelSubscription, getBillingHistory, createSispCheckout } from '../../services/billingService';
import useAuthStore from '../../store/authStore';
import usePlan, { PLAN_PRICES } from '../../hooks/usePlan';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useT } from '../../i18n';
import { CARTAO, CAIXA, TITULO, NUM } from './shared';
import { formatarData, formatarNumero } from '../../utils/formatoLingua';

/* ─────────────────────────────────────────────────────────
   TAB — FACTURACAO (subscricao SalDesk, distinta das credenciais de
   pagamento acima, que sao para o operador cobrar OS SEUS clientes)
───────────────────────────────────────────────────────── */
const PLAN_LABEL = { starter: 'Starter', business: 'Business', pro: 'Pro' };
/* Mesmo cambio fixo confirmado no backend (sispService.js's CVE_PER_EUR),
   exigido pelo checklist da SISP (preco expresso tambem em CVE). */
const CVE_PER_EUR = 110.265;
/* rotulo de cada estado: settings.facturacao.status.<estado> */
const STATUS_CONHECIDOS = ['trial', 'active', 'suspended', 'cancelled'];
const STATUS_VARIANT = { trial: 'info', active: 'confirmed', suspended: 'cancelled', cancelled: 'default' };
/* estado de cada pagamento do historico: Badge com o texto ao lado do ponto */
const PAGAMENTO_VARIANT = { completed: 'confirmed', failed: 'cancelled' };
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';

export default function FacturacaoTab() {
  const t = useT();
  const { operator, setOperator } = useAuthStore();
  const { isInTrial, isTrialExpired, trialDaysLeft } = usePlan();
  const [history, setHistory] = useState([]);
  const [subscribingPlan, setSubscribingPlan] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paymentMethodPlan, setPaymentMethodPlan] = useState(null); // plano escolhido, a aguardar metodo de pagamento
  const [billingPolicyOk, setBillingPolicyOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getBillingHistory().then(setHistory); }, []);

  async function handleSubscribe(plan) {
    setError('');
    setPaymentMethodPlan(null);
    setSubscribingPlan(plan);
    try {
      const { approval_url } = await createSubscription(plan);
      window.location.href = approval_url;
    } catch {
      setError(t('settings.facturacao.errSubscribe'));
      setSubscribingPlan(null);
    }
  }

  /* SISP e sempre um redirect: pede os campos a Vinti4 e auto-submete um
     formulario para la, mesma tecnica ja usada nas paginas publicas de
     reserva (ServiceDetail.jsx/PublicBooking.jsx) -- nao ha JSON de
     resposta para seguir, o browser sai mesmo do nosso site. */
  async function handleSisp(plan) {
    setError('');
    setPaymentMethodPlan(null);
    setSubscribingPlan(plan);
    try {
      const { postUrl, fields } = await createSispCheckout(plan);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = postUrl;
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = k; input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err?.response?.data?.code === 'SISP_NOT_CONFIGURED'
        ? t('settings.facturacao.errSispNotConfigured')
        : t('settings.facturacao.errSisp'));
      setSubscribingPlan(null);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelSubscription();
      const { data } = await api.get('/auth/me');
      setOperator(data.data.operator);
      setShowCancelModal(false);
    } catch {
      setError(t('settings.facturacao.errCancel'));
    } finally {
      setCancelling(false);
    }
  }

  const paidUntil = operator?.plan_paid_until ? new Date(operator.plan_paid_until) : null;
  const hasActiveSubscription = operator?.plan_status === 'active' && !!operator?.paypal_subscription_id;

  return (
    <div className="space-y-5 max-w-2xl">
      <section className={CARTAO}>
        <h2 className={`${TITULO} mb-4`}>{t('settings.facturacao.currentSubscription')}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-bold text-lg text-ocean-900">{PLAN_LABEL[operator?.plan] || operator?.plan}</p>
            {isInTrial() && <p className="text-xs font-body text-n-500 mt-1">{t('settings.facturacao.trialDaysLeft', { n: trialDaysLeft() })}</p>}
            {isTrialExpired() && <p className="text-xs font-body text-[var(--error)] mt-1">{t('settings.facturacao.trialEnded')}</p>}
            {hasActiveSubscription && paidUntil && (
              <p className="text-xs font-body text-n-500 mt-1">{t('settings.facturacao.renewsOn', { date: formatarData(paidUntil) })}</p>
            )}
            {!hasActiveSubscription && paidUntil && (
              <p className="text-xs font-body text-n-500 mt-1">{t('settings.facturacao.paidUntil', { date: formatarData(paidUntil) })}</p>
            )}
          </div>
          <Badge variant={STATUS_VARIANT[operator?.plan_status] || 'default'}>
            {STATUS_CONHECIDOS.includes(operator?.plan_status) ? t(`settings.facturacao.status.${operator.plan_status}`) : operator?.plan_status}
          </Badge>
        </div>
        {hasActiveSubscription && (
          <button type="button" onClick={() => setShowCancelModal(true)} className={`inline-flex items-center min-h-11 md:min-h-0 rounded-sm text-xs font-body font-semibold text-[var(--error)] hover:underline mt-3 ${FOCO}`}>
            {t('settings.facturacao.cancelSubscription')}
          </button>
        )}
      </section>

      {error && <p className="text-sm font-body text-[var(--error)] bg-[var(--error-light)] border border-n-200 rounded px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['starter', 'business', 'pro'].map((plan) => {
          const isCurrent = operator?.plan === plan && operator?.plan_status === 'active';
          return (
            <article key={plan} className={`${CARTAO}${isCurrent ? ' ring-2 ring-ocean-700' : ''}`}>
              <div className="space-y-2">
                <p className="font-display font-bold text-ocean-900">{PLAN_LABEL[plan]}</p>
                <p className="font-display font-bold text-2xl text-ocean-700"><span className={NUM}>€{PLAN_PRICES[plan]}</span><span className="text-xs font-body font-normal text-n-600">{t('settings.facturacao.perMonth')}</span></p>
                <Button
                  variant={isCurrent ? 'secondary' : 'primary'}
                  size="sm"
                  className="w-full min-h-11 md:min-h-0"
                  loading={subscribingPlan === plan}
                  disabled={isCurrent}
                  icon={Wallet}
                  onClick={() => { setBillingPolicyOk(false); setPaymentMethodPlan(plan); }}
                >
                  {isCurrent ? t('settings.facturacao.currentPlan') : t('settings.facturacao.subscribe')}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <section className={CARTAO}>
        <h2 className={`${TITULO} mb-4`}>{t('settings.facturacao.history')}</h2>
        {!history.length && <p className="text-sm font-body text-n-600">{t('settings.facturacao.noPayments')}</p>}
        <div className="space-y-2">
          {history.map((p) => (
            <div key={p.id} className={`${CAIXA} flex flex-wrap items-center justify-between gap-3 text-sm font-body`}>
              <div className="min-w-0">
                <p className="font-semibold text-n-900">{PLAN_LABEL[p.plan] || p.plan}</p>
                <p className={`text-xs text-n-600 ${NUM}`}>{formatarData(new Date(p.created_at))}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className={`font-semibold text-n-900 ${NUM}`}>€{Number(p.amount_eur).toFixed(2)}</p>
                <Badge variant={PAGAMENTO_VARIANT[p.status] || 'pending'}>
                  {p.status === 'completed' ? t('settings.facturacao.paid') : p.status === 'failed' ? t('settings.facturacao.failed') : t('settings.facturacao.pending')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!paymentMethodPlan} onClose={() => setPaymentMethodPlan(null)} title={t('settings.facturacao.howToPay')}>
        <div className="space-y-4">
          <p className="text-sm font-body text-n-600">
            {t('settings.facturacao.plan')} <strong>{PLAN_LABEL[paymentMethodPlan] || paymentMethodPlan}</strong> — €{PLAN_PRICES[paymentMethodPlan]}{t('settings.facturacao.perMonth')}
            <span className="text-n-600"> (≈ {formatarNumero(Math.round((PLAN_PRICES[paymentMethodPlan] || 0) * CVE_PER_EUR))} CVE)</span>.
          </p>
          <button
            type="button"
            onClick={() => handleSubscribe(paymentMethodPlan)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-n-200 hover:border-ocean-700 hover:bg-ocean-50 transition text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-n-200 disabled:hover:bg-transparent"
            disabled={!billingPolicyOk}
          >
            <div className="w-10 h-10 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
              <Wallet size={18} strokeWidth={2} className="text-ocean-700" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-n-900">PayPal</p>
              <p className="text-xs font-body text-n-500">{t('settings.facturacao.paypalRenews')}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSisp(paymentMethodPlan)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-n-200 hover:border-ocean-700 hover:bg-ocean-50 transition text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-n-200 disabled:hover:bg-transparent"
            disabled={!billingPolicyOk}
          >
            <div className="w-10 h-10 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
              <Landmark size={18} strokeWidth={2} className="text-ocean-700" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-n-900">SISP Vinti4</p>
              <p className="text-xs font-body text-n-500">{t('settings.facturacao.sispManual')}</p>
            </div>
          </button>
          <label className="flex items-start gap-2 text-xs font-body text-n-700 cursor-pointer border-t border-n-100 pt-3">
            <input type="checkbox" className="mt-0.5" checked={billingPolicyOk} onChange={(e) => setBillingPolicyOk(e.target.checked)} />
            <span>
              {t('settings.facturacao.acceptBefore')}{' '}
              <a href="https://saldesk.cv/termos.html#s6" target="_blank" rel="noreferrer" className="text-ocean-700 font-semibold hover:underline">
                {t('settings.facturacao.acceptLink')}
              </a>{' '}{t('settings.facturacao.acceptAfter')}
            </span>
          </label>
        </div>
      </Modal>

      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title={t('settings.facturacao.cancelSubscription')}>
        <div className="space-y-4">
          <p className="text-sm font-body text-n-600">
            {t('settings.facturacao.cancelConfirmText')}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)} className="flex-1">{t('settings.facturacao.back')}</Button>
            <Button variant="danger" loading={cancelling} onClick={handleCancel} className="flex-1">{t('settings.facturacao.confirmCancel')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
