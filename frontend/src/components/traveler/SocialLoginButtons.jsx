import { useState } from 'react';
import { signInWithProvider } from '../../services/travelerAuthService';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="#000" aria-hidden="true">
      <path d="M13.1 9.53c-.02-2.1 1.72-3.1 1.8-3.15-.98-1.43-2.5-1.63-3.04-1.65-1.3-.13-2.53.76-3.19.76-.66 0-1.68-.74-2.76-.72-1.42.02-2.73.83-3.46 2.1-1.47 2.56-.38 6.34 1.06 8.42.7 1.02 1.53 2.16 2.63 2.12 1.05-.04 1.45-.68 2.72-.68 1.27 0 1.63.68 2.75.66 1.14-.02 1.86-1.03 2.55-2.06.8-1.18 1.13-2.32 1.15-2.38-.03-.01-2.2-.85-2.21-3.36ZM11 3.13c.58-.7.97-1.68.86-2.66-.83.03-1.85.55-2.45 1.25-.53.62-1 1.62-.88 2.57.93.08 1.88-.47 2.47-1.16Z" />
    </svg>
  );
}

/* Botoes de acesso rapido Google/Apple -- ambos usam o mesmo mecanismo
   Supabase Auth (signInWithOAuth) ja usado pelo resto da app, so mudam o
   provider. Servem tanto para login como para registo: a primeira vez que
   alguem entra por aqui, a conta de viajante e criada automaticamente
   (ver TravelerOAuthCallback.jsx / oauthComplete no backend). */
export default function SocialLoginButtons() {
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [error, setError] = useState('');

  async function handleClick(provider) {
    setError('');
    setLoadingProvider(provider);
    try {
      await signInWithProvider(provider);
      /* navega para fora -- se chegar aqui sem redireccionar, algo falhou */
    } catch {
      setError('Nao foi possivel iniciar o login. Tente novamente.');
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleClick('google')}
        disabled={loadingProvider !== null}
        className="w-full h-11 rounded-full border border-n-200 bg-white hover:bg-n-50 flex items-center justify-center gap-2.5 text-sm font-body font-semibold text-n-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <GoogleMark />
        {loadingProvider === 'google' ? 'A abrir o Google…' : 'Continuar com Google'}
      </button>
      <button
        type="button"
        onClick={() => handleClick('apple')}
        disabled={loadingProvider !== null}
        className="w-full h-11 rounded-full border border-n-200 bg-white hover:bg-n-50 flex items-center justify-center gap-2.5 text-sm font-body font-semibold text-n-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <AppleMark />
        {loadingProvider === 'apple' ? 'A abrir a Apple…' : 'Continuar com Apple'}
      </button>
      {error && <p className="text-xs font-body text-error text-center">{error}</p>}
    </div>
  );
}
