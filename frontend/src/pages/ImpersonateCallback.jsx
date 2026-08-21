import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogIn } from 'lucide-react';
import supabaseImpersonateClient from '../lib/supabaseImpersonateClient';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import AuthLayout from '../components/auth/AuthLayout';

/* Alvo do redirectTo passado a generateLink({type:'magiclink'}) em
   impersonateOperator (adminController.js). Antes disto nao existia --
   o link gerado caia em /reset-password, que so aceita type=recovery e
   rejeitava um magiclink de imediato como "invalido". supabase-js
   processa o hash da URL (#access_token=...) sozinho ao carregar
   (detectSessionInUrl); so falta trocar essa sessao por um perfil de
   operador real e substituir a sessao actual do browser (aviso ja dado
   ao fundador antes de abrir o link -- guarde a sessao actual). */
export default function ImpersonateCallback() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;

    async function concluir(session) {
      if (!session?.access_token || cancelado) return;
      try {
        const { data } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const { user, operator } = data.data;
        if (!operator) throw new Error('Sem operador associado a esta conta');
        setAuth(session.access_token, user, operator, session.refresh_token);
        navigate('/', { replace: true });
      } catch {
        if (!cancelado) setError('Nao foi possivel entrar como este operador. Gere o link novamente.');
      }
    }

    supabaseImpersonateClient.auth.getSession().then(({ data }) => {
      if (data?.session) concluir(data.session);
    });

    const { data: subscription } = supabaseImpersonateClient.auth.onAuthStateChange((_event, session) => {
      if (session) concluir(session);
    });

    const timeout = setTimeout(() => {
      if (!cancelado) setError('O acesso demorou demasiado tempo. Tente novamente.');
    }, 12000);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
      subscription?.subscription?.unsubscribe();
    };
  }, [setAuth, navigate]);

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-lg p-6 text-center space-y-4">
        {error ? (
          <>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={22} strokeWidth={1.75} className="text-error" />
            </div>
            <div>
              <p className="font-display font-bold text-base text-n-900">Nao foi possivel entrar</p>
              <p className="text-sm font-body text-n-500 mt-1">{error}</p>
            </div>
            <a href="/login" className="inline-block text-sm font-body font-semibold text-ocean-700 hover:underline">
              Voltar ao login
            </a>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-ocean-50 rounded-full flex items-center justify-center mx-auto">
              <LogIn size={20} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div>
              <p className="font-display font-bold text-base text-n-900">A entrar como operador</p>
              <p className="text-sm font-body text-n-500 mt-1">Um momento…</p>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
