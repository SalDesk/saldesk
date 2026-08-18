import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import supabaseAuthClient from '../../lib/supabaseAuthClient';
import useTravelerAuthStore, { setTravelerRememberDevice } from '../../store/travelerAuthStore';
import { completeOAuthLogin } from '../../services/travelerAuthService';
import TravelerAuthLayout from '../../components/traveler/TravelerAuthLayout';
import Logo from '../../components/shared/Logo';

/* Alvo do redirectTo passado a signInWithOAuth(). O supabase-js processa o
   hash da URL (#access_token=...) sozinho ao carregar (detectSessionInUrl),
   por isso so e preciso esperar pela sessao e trocar-la por uma conta de
   viajante real. */
export default function TravelerOAuthCallback() {
  const { setAuth } = useTravelerAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;

    async function concluir(session) {
      if (!session?.access_token || cancelado) return;
      try {
        const { user, traveler } = await completeOAuthLogin(session.access_token, session.refresh_token);
        setTravelerRememberDevice(true);
        setAuth(session.access_token, user, traveler, session.refresh_token);
        navigate('/viajante', { replace: true });
      } catch {
        if (!cancelado) setError('Nao foi possivel concluir o login. Tente novamente.');
      }
    }

    supabaseAuthClient.auth.getSession().then(({ data }) => {
      if (data?.session) concluir(data.session);
    });

    const { data: subscription } = supabaseAuthClient.auth.onAuthStateChange((_event, session) => {
      if (session) concluir(session);
    });

    const timeout = setTimeout(() => {
      if (!cancelado) setError('O login demorou demasiado tempo. Tente novamente.');
    }, 12000);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
      subscription?.subscription?.unsubscribe();
    };
  }, [setAuth, navigate]);

  return (
    <TravelerAuthLayout>
      <div className="bg-white rounded-3xl shadow-xl shadow-ocean-900/10 p-8 text-center space-y-4">
        <div className="flex justify-center"><Logo size="lg" dark /></div>
        {error ? (
          <>
            <div className="w-11 h-11 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={20} strokeWidth={1.75} className="text-error" />
            </div>
            <p className="text-sm font-body text-n-600">{error}</p>
            <a href="/viajante/entrar" className="inline-block text-sm font-body font-semibold text-ocean-700 hover:underline">
              Voltar ao login
            </a>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-ocean-200 border-t-ocean-700 rounded-full animate-spin mx-auto" />
            <p className="text-sm font-body text-n-500">A concluir o login…</p>
          </>
        )}
      </div>
    </TravelerAuthLayout>
  );
}
