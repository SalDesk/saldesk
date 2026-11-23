import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useT } from '../i18n';

export default function BillingCancel() {
  const t = useT();

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <XCircle size={32} strokeWidth={2} className="text-red-600" />
        </div>
        <h1 className="font-display font-bold text-xl text-n-900 mb-3">
          {t('billingResult.cancelTitle')}
        </h1>
        <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
          {t('billingResult.cancelBody')}
        </p>
        <Link to="/definicoes?tab=facturacao" className="text-sm font-body font-semibold text-ocean-700 hover:underline">
          {t('billingResult.backToBilling')}
        </Link>
      </div>
    </div>
  );
}
