import { useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function BookingCancel() {
  const [searchParams] = useSearchParams();
  const lang = localStorage.getItem('sd-lang') || 'pt';
  const erro = searchParams.get('erro');

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <XCircle size={32} strokeWidth={2} className="text-red-600" />
        </div>
        <h1 className="font-display font-bold text-xl text-n-900 mb-3">
          {lang === 'en' ? 'Payment not completed' : 'Pagamento não concluído'}
        </h1>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-2">
          {erro
            ? (lang === 'en'
                ? 'The payment was cancelled or could not be validated.'
                : 'O pagamento foi cancelado ou não pôde ser validado.')
            : (lang === 'en'
                ? 'You cancelled the payment. No charge was made.'
                : 'Cancelou o pagamento. Não houve qualquer cobrança.')}
        </p>
        <p className="text-xs font-body text-n-400 leading-relaxed">
          {lang === 'en'
            ? 'You can go back and try again, or contact the operator directly.'
            : 'Pode voltar atrás e tentar novamente, ou contactar o operador directamente.'}
        </p>
      </div>
    </div>
  );
}
