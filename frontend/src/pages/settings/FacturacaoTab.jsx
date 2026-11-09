import { useState, useEffect } from 'react';
import { Wallet, Landmark } from 'lucide-react';
import api from '../../services/api';
import { createSubscription, cancelSubscription, getBillingHistory, createSispCheckout } from '../../services/billingService';
import useAuthStore from '../../store/authStore';
import usePlan, { PLAN_PRICES } from '../../hooks/usePlan';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

/* ─────────────────────────────────────────────────────────
   TAB — FACTURACAO (subscricao SalDesk, distinta das credenciais de
   pagamento acima, que sao para o operador cobrar OS SEUS clientes)
───────────────────────────────────────────────────────── */
const PLAN_LABEL = { starter: 'Starter', business: 'Business', pro: 'Pro' };
/* Mesmo cambio fixo confirmado no backend (sispService.js's CVE_PER_EUR),
   exigido pelo checklist da SISP (preco expresso tambem em CVE). */
const CVE_PER_EUR = 110.265;
const STATUS_LABEL = { trial: 'Periodo de avaliacao', active: 'Activo', suspended: 'Suspenso', cancelled: 'Cancelado' };
const STATUS_TONE  = { trial: 'text-ocean-700 bg-ocean-50', active: 'text-green-700 bg-green-50', suspended: 'text-error bg-red-50', cancelled: 'text-n-500 bg-n-100' };

export default function FacturacaoTab() {
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
      setError('Nao foi possivel iniciar a subscricao. Tenta novamente.');
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
        ? 'O pagamento por SISP ainda nao esta disponivel para a subscricao SalDesk.'
        : 'Nao foi possivel iniciar o pagamento SISP. Tenta novamente.');
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
      setError('Nao foi possivel cancelar a subscricao. Tenta novamente.');
    } finally {
      setCancelling(false);
    }
  }

  const paidUntil = operator?.plan_paid_until ? new Date(operator.plan_paid_until) : null;
  const hasActiveSubscription = operator?.plan_status === 'active' && !!operator?.paypal_subscription_id;

  return (
    <div className="space-y-5 max-w-2xl">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Subscricao actual</h3>}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display font-bold text-lg text-n-900">{PLAN_LABEL[operator?.plan] || operator?.plan}</p>
            {isInTrial() && <p className="text-xs font-body text-n-500 mt-1">{trialDaysLeft()} dias restantes no periodo de avaliacao</p>}
            {isTrialExpired() && <p className="text-xs font-body text-error mt-1">Periodo de avaliacao terminado</p>}
            {hasActiveSubscription && paidUntil && (
              <p className="text-xs font-body text-n-500 mt-1">Renova automaticamente a {paidUntil.toLocaleDateString('pt-PT')}</p>
            )}
            {!hasActiveSubscription && paidUntil && (
              <p className="text-xs font-body text-n-500 mt-1">Pago ate {paidUntil.toLocaleDateString('pt-PT')}</p>
            )}
          </div>
          <span className={`text-xs font-body font-semibold px-3 py-1.5 rounded-full ${STATUS_TONE[operator?.plan_status] || 'text-n-500 bg-n-100'}`}>
            {STATUS_LABEL[operator?.plan_status] || operator?.plan_status}
          </span>
        </div>
        {hasActiveSubscription && (
          <button onClick={() => setShowCancelModal(true)} className="text-xs font-body font-semibold text-error hover:underline mt-3">
            Cancelar subscricao
          </button>
        )}
      </Card>

      {error && <p className="text-sm font-body text-error bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['starter', 'business', 'pro'].map((plan) => {
          const isCurrent = operator?.plan === plan && operator?.plan_status === 'active';
          return (
            <Card key={plan} className={isCurrent ? 'border-ocean-700' : ''}>
              <div className="space-y-2">
                <p className="font-display font-bold text-n-900">{PLAN_LABEL[plan]}</p>
                <p className="font-display font-bold text-2xl text-ocean-700">€{PLAN_PRICES[plan]}<span className="text-xs font-body font-normal text-n-500">/mes</span></p>
                <Button
                  variant={isCurrent ? 'secondary' : 'primary'}
                  size="sm"
                  className="w-full"
                  loading={subscribingPlan === plan}
                  disabled={isCurrent}
                  icon={Wallet}
                  onClick={() => { setBillingPolicyOk(false); setPaymentMethodPlan(plan); }}
                >
                  {isCurrent ? 'Plano actual' : 'Subscrever'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Historico de pagamentos</h3>}>
        {!history.length && <p className="text-sm font-body text-n-500">Sem pagamentos registados.</p>}
        <div className="space-y-2">
          {history.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-sm font-body py-2 border-b border-n-100 last:border-0">
              <div>
                <p className="font-semibold text-n-900">{PLAN_LABEL[p.plan] || p.plan}</p>
                <p className="text-xs text-n-500">{new Date(p.created_at).toLocaleDateString('pt-PT')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-n-900">€{Number(p.amount_eur).toFixed(2)}</p>
                <p className={`text-xs ${p.status === 'completed' ? 'text-green-700' : p.status === 'failed' ? 'text-error' : 'text-n-500'}`}>
                  {p.status === 'completed' ? 'Pago' : p.status === 'failed' ? 'Falhou' : 'Pendente'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!paymentMethodPlan} onClose={() => setPaymentMethodPlan(null)} title="Como quer pagar?">
        <div className="space-y-4">
          <p className="text-sm font-body text-n-600">
            Plano <strong>{PLAN_LABEL[paymentMethodPlan] || paymentMethodPlan}</strong> — €{PLAN_PRICES[paymentMethodPlan]}/mes
            <span className="text-n-400"> (≈ {Math.round((PLAN_PRICES[paymentMethodPlan] || 0) * CVE_PER_EUR).toLocaleString('pt-PT')} CVE)</span>.
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
              <p className="text-xs font-body text-n-500">Renova automaticamente todos os meses</p>
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
              <p className="text-xs font-body text-n-500">Pagamento em escudos, manual todos os meses (sem renovacao automatica)</p>
            </div>
          </button>
          <label className="flex items-start gap-2 text-xs font-body text-n-700 cursor-pointer border-t border-n-100 pt-3">
            <input type="checkbox" className="mt-0.5" checked={billingPolicyOk} onChange={(e) => setBillingPolicyOk(e.target.checked)} />
            <span>
              Li e aceito a{' '}
              <a href="https://saldesk.cv/termos.html#s6" target="_blank" rel="noreferrer" className="text-ocean-700 font-semibold hover:underline">
                política de cancelamento e reembolsos
              </a>{' '}da subscrição SalDesk.
            </span>
          </label>
        </div>
      </Modal>

      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancelar subscricao">
        <div className="space-y-4">
          <p className="text-sm font-body text-n-600">
            Tens a certeza que queres cancelar a subscricao? A cobranca automatica mensal termina
            imediatamente e a conta fica suspensa assim que o periodo já pago acabar.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)} className="flex-1">Voltar</Button>
            <Button variant="danger" loading={cancelling} onClick={handleCancel} className="flex-1">Confirmar cancelamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
