import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../services/api';
import { confirmSubscription } from '../services/billingService';
import useAuthStore from '../store/authStore';

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const setOperator = useAuthStore((s) => s.setOperator);
  const lang = localStorage.getItem('sd-lang') || 'pt';
  const subscriptionId = searchParams.get('subscription_id');
  const [status, setStatus] = useState('confirming');

  useEffect(() => {
    if (!subscriptionId) { setStatus('error'); return; }
    confirmSubscription(subscriptionId)
      .then(() => api.get('/auth/me'))
      .then(({ data }) => { setOperator(data.data.operator); setStatus('done'); })
      .catch(() => setStatus('error'));
  }, [subscriptionId]);

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
        {status === 'confirming' && (
          <>
            <div className="w-16 h-16 rounded-full bg-ocean-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 size={32} strokeWidth={2} className="text-ocean-700 animate-spin" />
            </div>
            <h1 className="font-display font-bold text-xl text-n-900 mb-3">
              {lang === 'en' ? 'Confirming payment...' : 'A confirmar pagamento...'}
            </h1>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} strokeWidth={2} className="text-green-600" />
            </div>
            <h1 className="font-display font-bold text-xl text-n-900 mb-3">
              {lang === 'en' ? 'Payment confirmed!' : 'Pagamento confirmado!'}
            </h1>
            <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
              {lang === 'en'
                ? 'Your SalDesk subscription is now active.'
                : 'A tua subscricao SalDesk esta agora activa.'}
            </p>
            <Link to="/definicoes?tab=facturacao" className="text-sm font-body font-semibold text-ocean-700 hover:underline">
              {lang === 'en' ? 'Back to Billing' : 'Voltar a Facturacao'}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <XCircle size={32} strokeWidth={2} className="text-error" />
            </div>
            <h1 className="font-display font-bold text-xl text-n-900 mb-3">
              {lang === 'en' ? 'Could not confirm payment' : 'Nao foi possivel confirmar o pagamento'}
            </h1>
            <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
              {lang === 'en'
                ? 'If the payment was completed, it will be applied shortly. Otherwise, try again.'
                : 'Se o pagamento foi concluido, sera aplicado em breve. Caso contrario, tenta novamente.'}
            </p>
            <Link to="/definicoes?tab=facturacao" className="text-sm font-body font-semibold text-ocean-700 hover:underline">
              {lang === 'en' ? 'Back to Billing' : 'Voltar a Facturacao'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
