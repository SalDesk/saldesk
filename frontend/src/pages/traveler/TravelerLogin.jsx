import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import useTravelerAuthStore, { setTravelerRememberDevice } from '../../store/travelerAuthStore';
import { login, forgotPassword } from '../../services/travelerAuthService';
import AuthLayout from '../../components/auth/AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Logo from '../../components/shared/Logo';

function AuthCard({ children }) {
  return (
    <div className="relative bg-white rounded-2xl shadow-lg shadow-ocean-900/25 border border-n-100 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-sand-500 via-sand-400 to-sand-500" />
      <div className="p-7">
        <div className="flex justify-center mb-5">
          <Logo size="xl" dark />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function TravelerLogin() {
  const { token, setAuth } = useTravelerAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode,        setMode]        = useState('login'); // 'login' | 'forgot' | 'forgot-sent'
  const [form,        setForm]        = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [remember,    setRemember]    = useState(false);

  const registeredOk = searchParams.get('registered') === '1';
  const resetOk      = searchParams.get('reset') === '1';

  useEffect(() => { if (token) navigate('/viajante'); }, [token, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      setTravelerRememberDevice(remember);
      setAuth(result.access_token, result.user, result.traveler, result.refresh_token);
      navigate('/viajante');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciais invalidas.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(forgotEmail);
    } catch {
      /* nunca revelar se o email existe */
    } finally {
      setLoading(false);
      setMode('forgot-sent');
    }
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout>
        <AuthCard>
          <p className="text-[11px] font-mono uppercase tracking-wider text-ocean-500 mb-2">Recuperar acesso</p>
          <h1 className="font-display font-bold text-lg text-n-900 mb-1">Esqueceu-se da password?</h1>
          <p className="text-xs font-body text-n-500 mb-5">
            Introduza o seu email e enviamos um link para repor a password.
          </p>
          <form onSubmit={handleForgot} className="space-y-4">
            <Input
              label="Email" type="email" placeholder="nome@email.com"
              value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
              required autoComplete="email"
            />
            {error && (
              <div className="px-3 py-2 rounded-sm bg-red-50 text-error text-sm font-body">{error}</div>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Enviar link de recuperacao
            </Button>
          </form>
          <button onClick={() => setMode('login')}
            className="mt-4 text-xs font-body text-ocean-700 hover:underline w-full text-center">
            Voltar ao login
          </button>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (mode === 'forgot-sent') {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto">
              <Shield size={22} strokeWidth={1.75} className="text-[#1A7A4A]" />
            </div>
            <div>
              <p className="font-display font-bold text-base text-n-900">Email enviado</p>
              <p className="text-sm font-body text-n-500 mt-1">
                Se <span className="font-semibold text-n-700">{forgotEmail}</span> tiver uma conta, vai receber um link de recuperacao.
              </p>
            </div>
            <p className="text-xs font-body text-n-400">Verifique tambem a pasta de spam.</p>
            <button onClick={() => { setMode('login'); setForgotEmail(''); }}
              className="text-sm font-body font-semibold text-ocean-700 hover:underline">
              Voltar ao login
            </button>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <p className="text-[11px] font-mono uppercase tracking-wider text-ocean-500 mb-2">Conta de viajante</p>
        <h1 className="font-display font-bold text-lg text-n-900 mb-5">Entrar</h1>

        {registeredOk && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[#ECFDF5] border border-green-200 text-[#1A7A4A] text-sm font-body">
            Conta criada com sucesso. Ja pode entrar.
          </div>
        )}
        {resetOk && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[#ECFDF5] border border-green-200 text-[#1A7A4A] text-sm font-body">
            Password actualizada. Entre com a nova password.
          </div>
        )}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 border border-red-200 text-error text-sm font-body flex items-start gap-2">
            <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email" type="email" placeholder="nome@email.com"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            required autoComplete="email"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
                className="w-full h-10 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-sand-300 focus:border-ocean-700 focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-ocean-700 transition-colors">
                {showPw ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-3.5 h-3.5 accent-ocean-700 rounded" />
              <span className="text-xs font-body text-n-600">Lembrar este dispositivo</span>
            </label>

            <button
              type="button"
              onClick={() => { setMode('forgot'); setForgotEmail(form.email); setError(''); }}
              className="text-xs text-ocean-700 hover:text-ocean-500 shrink-0 ml-2">
              Esqueceu a password?
            </button>
          </div>

          <Button type="submit" loading={loading} className="w-full" icon={Lock}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-n-100 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-n-50 text-n-400">
            <Shield size={12} strokeWidth={1.75} />
            <span className="text-[10px] font-mono uppercase tracking-wider">Ligacao segura SSL</span>
          </span>
        </div>
      </AuthCard>

      <p className="text-center text-sm font-body text-white/80 mt-4">
        Ainda nao tem conta?{' '}
        <Link to="/viajante/registar" className="font-semibold text-white hover:text-sand-300 underline">
          Registar
        </Link>
      </p>
    </AuthLayout>
  );
}
