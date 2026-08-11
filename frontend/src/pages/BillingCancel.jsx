import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function BillingCancel() {
  const lang = localStorage.getItem('sd-lang') || 'pt';

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <XCircle size={32} strokeWidth={2} className="text-red-600" />
        </div>
        <h1 className="font-display font-bold text-xl text-n-900 mb-3">
          {lang === 'en' ? 'Payment not completed' : 'Pagamento nao concluido'}
        </h1>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
          {lang === 'en'
            ? 'You cancelled the payment. No charge was made and your plan was not changed.'
            : 'Cancelaste o pagamento. Nao houve qualquer cobranca e o teu plano nao foi alterado.'}
        </p>
        <Link to="/definicoes?tab=facturacao" className="text-sm font-body font-semibold text-ocean-700 hover:underline">
          {lang === 'en' ? 'Back to Billing' : 'Voltar a Facturacao'}
        </Link>
      </div>
    </div>
  );
}
