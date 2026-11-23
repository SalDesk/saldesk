import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../services/api';
import { confirmSubscription } from '../services/billingService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const setOperator = useAuthStore((s) => s.setOperator);
  const t = useT();
  const subscriptionId = searchParams.get('subscription_id');
  const gateway = searchParams.get('gateway');
  const [status, setStatus] = useState('confirming');

  useEffect(() => {
    /* SISP ja confirmou e activou o pagamento no proprio callback do
       backend (redirect directo da Vinti4, sem passar por aqui antes) --
       so falta ir buscar o operador actualizado, nunca chamar
       confirmSubscription (isso e so para o fluxo PayPal). */
    if (gateway === 'sisp') {
      api.get('/auth/me')
        .then(({ data }) => { setOperator(data.data.operator); setStatus('done'); })
        .catch(() => setStatus('error'));
      return;
    }
    if (!subscriptionId) { setStatus('error'); return; }
    confirmSubscription(subscriptionId)
      .then(() => api.get('/auth/me'))
      .then(({ data }) => { setOperator(data.data.operator); setStatus('done'); })
      .catch(() => setStatus('error'));
  }, [subscriptionId, gateway]);

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
        {status === 'confirming' && (
          <>
            <div className="w-16 h-16 rounded-full bg-ocean-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 size={32} strokeWidth={2} className="text-ocean-700 animate-spin" />
            </div>
            <h1 className="font-display font-bold text-xl text-n-900 mb-3">
              {t('billingResult.confirming')}
            </h1>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} strokeWidth={2} className="text-green-600" />
            </div>
            <h1 className="font-display font-bold text-xl text-n-900 mb-3">
              {t('billingResult.confirmed')}
            </h1>
            <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
              {t('billingResult.confirmedBody')}
            </p>
            <Link to="/definicoes?tab=facturacao" className="text-sm font-body font-semibold text-ocean-700 hover:underline">
              {t('billingResult.backToBilling')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <XCircle size={32} strokeWidth={2} className="text-error" />
            </div>
            <h1 className="font-display font-bold text-xl text-n-900 mb-3">
              {t('billingResult.errorTitle')}
            </h1>
            <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
              {t('billingResult.errorBody')}
            </p>
            <Link to="/definicoes?tab=facturacao" className="text-sm font-body font-semibold text-ocean-700 hover:underline">
              {t('billingResult.backToBilling')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
