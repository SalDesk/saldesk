import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { demoLogin } from '../services/authService';
import useAuthStore from '../store/authStore';
import { getT } from '../i18n';
import { useLingua } from '../utils/formatoLingua';

export default function DemoEntry() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState('loading'); // loading | error | done
  /* Quem veio do site publico em ingles (sd-lang) continua a ler ingles; senao segue a lingua do painel */
  const linguaPainel = useLingua();
  const lang = localStorage.getItem('sd-lang') === 'en' ? 'en' : linguaPainel;
  const t = getT(lang);

  useEffect(() => {
    let cancelled = false;
    demoLogin()
      .then((data) => {
        if (cancelled) return;
        setAuth(data.access_token, data.user, data.operator, data.refresh_token);
        setStatus('done');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [setAuth]);

  if (status === 'done') return <Navigate to="/dashboard" replace />;

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-n-100 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={32} strokeWidth={2} className="text-red-600" />
          </div>
          <h1 className="font-display font-bold text-xl text-n-900 mb-3">
            {t('demoEntry.unavailableTitle')}
          </h1>
          <p className="text-sm font-body text-n-500 leading-relaxed mb-6">
            {t('demoEntry.unavailableText')}
          </p>
          <a href="https://saldesk.cv" className="text-sm font-semibold text-ocean-700 hover:underline">
            {t('demoEntry.back')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-n-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-ocean-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-body text-n-500">
          {t('demoEntry.preparing')}
        </p>
      </div>
    </div>
  );
}
