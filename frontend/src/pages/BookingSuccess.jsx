import { useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const lang = localStorage.getItem('sd-lang') || 'pt';
  const res = searchParams.get('res');

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} strokeWidth={2} className="text-green-600" />
        </div>
        <h1 className="font-display font-bold text-xl text-n-900 mb-3">
          {lang === 'en' ? 'Payment confirmed!' : 'Pagamento confirmado!'}
        </h1>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
          {lang === 'en'
            ? 'Your booking is confirmed. You will receive a confirmation email shortly.'
            : 'A sua reserva foi confirmada. Vai receber um email de confirmação em breve.'}
        </p>
        {res && (
          <div className="bg-n-50 border border-n-200 rounded-xl px-4 py-3 inline-block mb-6">
            <p className="text-xs text-n-400 font-body mb-1">
              {lang === 'en' ? 'Booking reference' : 'Referência da reserva'}
            </p>
            <p className="font-mono font-bold text-n-800 text-sm tracking-widest">
              {res.slice(0, 8).toUpperCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
