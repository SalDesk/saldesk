import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { login, forgotPassword } from '../services/authService';
import { useT } from '../i18n';
import AuthLayout from '../components/auth/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

/* ── Rate limiting (localStorage) ── */
const MAX_ATTEMPTS     = 5;
const LOCKOUT_MINUTES  = 15;
const WARN_AFTER       = 3;

function rateLimitKey(email) { return `saldesk_login_attempts_${email.toLowerCase().trim()}`; }

function getRateState(email) {
  if (!email) return { count: 0, lockedUntil: 0 };
  try {
    return JSON.parse(localStorage.getItem(rateLimitKey(email)) || '{"count":0,"lockedUntil":0}');
  } catch { return { count: 0, lockedUntil: 0 }; }
}

function setRateState(email, state) {
  localStorage.setItem(rateLimitKey(email), JSON.stringify(state));
}

function clearRateState(email) {
  localStorage.removeItem(rateLimitKey(email));
}

function isLocked(state) {
  return state.lockedUntil > Date.now();
}

function remainingSeconds(state) {
  return Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
}

function recordFailedAttempt(email) {
  const state = getRateState(email);
  const newCount = state.count + 1;
  const newState = {
    count: newCount,
    lockedUntil: newCount >= MAX_ATTEMPTS
      ? Date.now() + LOCKOUT_MINUTES * 60 * 1000
      : 0,
  };
  setRateState(email, newState);
  return newState;
}

/* ─────────────────────── Login ─────────────────────── */
export default function Login() {
  const t = useT();
  const { token, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* mode: 'login' | 'forgot' | 'forgot-sent' */
  const [mode,         setMode]         = useState('login');
  const [form,         setForm]         = useState({ email: '', password: '' });
  const [forgotEmail,  setForgotEmail]  = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPw,       setShowPw]       = useState(false);
  const [remember,     setRemember]     = useState(false);
  const [countdown,    setCountdown]    = useState(0);
  const [rateState,    setRateStateLocal] = useState({ count: 0, lockedUntil: 0 });
  const countdownRef = useRef(null);

  const registeredOk = searchParams.get('registered') === '1';
  const resetOk      = searchParams.get('reset') === '1';

  useEffect(() => { if (token) { const user = JSON.parse(localStorage.getItem('saldesk-auth') || '{}')?.state?.user; if (user?.user_metadata?.role === 'FUNDADOR') navigate('/admin'); else navigate('/'); } }, [token, navigate]);

  /* Update rate state when email changes */
  useEffect(() => {
    if (!form.email) return;
    const state = getRateState(form.email);
    setRateStateLocal(state);
    if (isLocked(state)) startCountdown(state);
  }, [form.email]);

  function startCountdown(state) {
    const secs = remainingSeconds(state);
    setCountdown(secs);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setRateStateLocal({ count: 0, lockedUntil: 0 });
          clearRateState(form.email);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  function formatCountdown(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    const state = getRateState(form.email);
    if (isLocked(state)) return;

    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      clearRateState(form.email);
      setAuth(result.access_token, result.user, result.operator);
      if (result.user?.user_metadata?.role === 'FUNDADOR') {
        navigate('/admin');
      } else {
        navigate(result.operator?.onboarding_complete ? '/dashboard' : '/onboarding');
      }
    } catch {
      /* Always show a generic message — never reveal if email exists */
      const newState = recordFailedAttempt(form.email);
      setRateStateLocal(newState);
      if (isLocked(newState)) {
        startCountdown(newState);
        setError(`Conta temporariamente bloqueada por ${LOCKOUT_MINUTES} minutos por excesso de tentativas.`);
      } else {
        const remaining = MAX_ATTEMPTS - newState.count;
        setError(`Email ou password incorrectos.${remaining <= (MAX_ATTEMPTS - WARN_AFTER) ? ` Ainda tem ${remaining} tentativa(s).` : ''}`);
      }
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
      /* Always show success to avoid email enumeration */
    } finally {
      setLoading(false);
      setMode('forgot-sent');
    }
  }

  const locked    = isLocked(rateState);
  const attemptsUsed = rateState.count;
  const showWarn  = attemptsUsed >= WARN_AFTER && !locked;

  /* ── Forgot password mode ── */
  if (mode === 'forgot') {
    return (
      <AuthLayout>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="font-display font-bold text-base text-n-900 mb-1">Recuperar password</h1>
          <p className="text-xs font-body text-n-500 mb-5">
            Indica o teu email e enviamos um link para repor a password.
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
        </div>
      </AuthLayout>
    );
  }

  if (mode === 'forgot-sent') {
    return (
      <AuthLayout>
        <div className="bg-white rounded-lg shadow-lg p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto">
            <Shield size={22} strokeWidth={1.75} className="text-[#1A7A4A]" />
          </div>
          <div>
            <p className="font-display font-bold text-base text-n-900">Email enviado</p>
            <p className="text-sm font-body text-n-500 mt-1">
              Se o email <span className="font-semibold text-n-700">{forgotEmail}</span> existir
              na nossa plataforma, recebes um link de recuperacao em breve.
            </p>
          </div>
          <p className="text-xs font-body text-n-400">
            Verifica tambem a pasta de spam. O link expira em 1 hora.
          </p>
          <button onClick={() => { setMode('login'); setForgotEmail(''); }}
            className="text-sm font-body font-semibold text-ocean-700 hover:underline">
            Voltar ao login
          </button>
        </div>
      </AuthLayout>
    );
  }

  /* ── Login mode ── */
  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="font-display font-bold text-base text-n-900 mb-5">
          {t('auth.loginTitle')}
        </h1>

        {/* Success banners */}
        {registeredOk && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[#ECFDF5] border border-green-200 text-[#1A7A4A] text-sm font-body">
            Conta criada com sucesso. Faz login para continuar.
          </div>
        )}
        {resetOk && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[#ECFDF5] border border-green-200 text-[#1A7A4A] text-sm font-body">
            Password reposta com sucesso. Faz login com a nova password.
          </div>
        )}

        {/* Error / lockout */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 border border-red-200 text-error text-sm font-body flex items-start gap-2">
            <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Attempts warning */}
        {showWarn && !error && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-body flex items-start gap-2">
            <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
            <span>{MAX_ATTEMPTS - attemptsUsed} tentativa(s) restante(s) antes do bloqueio.</span>
          </div>
        )}

        {/* Lockout countdown */}
        {locked && countdown > 0 && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 border border-red-200 text-error text-sm font-body text-center">
            <p className="font-semibold">Acesso bloqueado</p>
            <p className="text-xs mt-0.5">Tenta novamente em <span className="font-mono font-bold">{formatCountdown(countdown)}</span></p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label={t('auth.email')} type="email" placeholder="nome@email.com"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            required autoComplete="email"
            disabled={locked}
          />

          {/* Password with show/hide */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
              {t('auth.password')}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
                disabled={locked}
                className="w-full h-9 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                {showPw
                  ? <EyeOff size={15} strokeWidth={1.75} />
                  : <Eye    size={15} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-3.5 h-3.5 accent-ocean-700 rounded" />
              <span className="text-xs font-body text-n-600">Lembrar este dispositivo por 30 dias</span>
            </label>

            <button
              type="button"
              onClick={() => { setMode('forgot'); setForgotEmail(form.email); setError(''); }}
              className="text-xs text-ocean-700 hover:text-ocean-500 shrink-0 ml-2">
              {t('auth.forgotPassword')}
            </button>
          </div>

          <Button type="submit" loading={loading} disabled={locked} className="w-full" icon={Lock}>
            {t('auth.login')}
          </Button>
        </form>

        {/* SSL badge */}
        <div className="mt-5 pt-4 border-t border-n-100 flex items-center justify-center gap-1.5 text-n-400">
          <Shield size={12} strokeWidth={1.75} />
          <span className="text-[11px] font-mono uppercase tracking-wider">Ligacao segura SSL</span>
        </div>
      </div>

      <p className="text-center text-sm font-body text-white/80 mt-4">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-white hover:text-sand-300 underline">
          {t('auth.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
