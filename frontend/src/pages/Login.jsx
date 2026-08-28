import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import useAuthStore, { setRememberDevice } from '../store/authStore';
import { login, forgotPassword } from '../services/authService';
import { isVendedor, isStaff } from '../utils/userRoles';
import { useT } from '../i18n';
import AuthLayout from '../components/auth/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

/* ── Bloqueio de conta ──
   O bloqueio real agora vive no servidor (authController.js) -- este
   ficheiro so reflecte o que a API responde (423 ACCOUNT_LOCKED /
   401 com attempts_remaining), nunca decide sozinho. Antes disto, todo
   o "bloqueio" vivia so aqui em localStorage e dava para contornar com
   um pedido directo a API (curl, Postman, etc.). MAX_ATTEMPTS/WARN_AFTER
   ficam so como constantes de apresentacao, espelhando o que o backend
   usa (logStore.js), para a mensagem de aviso bater certo. */
const MAX_ATTEMPTS = 5;
const WARN_AFTER    = 3;

function isLocked(state) {
  return state.lockedUntil > Date.now();
}

function remainingSeconds(state) {
  return Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
}

/* Cartao base reutilizado nos 3 modos (login / forgot / forgot-sent) --
   o logo proprio e a barra decorativa foram removidos: no layout novo
   (AuthLayout.jsx com painel dividido), a marca ja aparece no painel
   esquerdo (desktop) ou no cabecalho (mobile), repeti-la aqui ficava
   redundante numa pagina que agora assenta em fundo branco simples. */
function AuthCard({ children }) {
  return <div>{children}</div>;
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

  useEffect(() => {
    if (token) {
      const user = JSON.parse(localStorage.getItem('saldesk-auth') || '{}')?.state?.user;
      if (user?.user_metadata?.role === 'FUNDADOR') navigate('/admin');
      else if (isVendedor(user)) navigate('/vendedor');
      else if (isStaff(user)) navigate('/staff');
      else navigate('/');
    }
  }, [token, navigate]);

  function startCountdown(lockedUntil) {
    const state = { count: MAX_ATTEMPTS, lockedUntil };
    setRateStateLocal(state);
    setCountdown(remainingSeconds(state));
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setRateStateLocal({ count: 0, lockedUntil: 0 });
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

    if (isLocked(rateState)) return;

    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      setRateStateLocal({ count: 0, lockedUntil: 0 });
      setRememberDevice(remember);
      setAuth(result.access_token, result.user, result.operator, result.refresh_token);
      if (result.user?.user_metadata?.role === 'FUNDADOR') {
        navigate('/admin');
      } else if (isVendedor(result.user)) {
        navigate('/vendedor');
      } else if (isStaff(result.user)) {
        navigate('/staff');
      } else {
        navigate(result.operator?.onboarding_complete ? '/dashboard' : '/onboarding');
      }
    } catch (err) {
      /* O bloqueio real vem sempre do servidor (authController.js) --
         nunca decidido so no browser, para nao ser contornavel com um
         pedido directo a API. */
      const body = err?.response?.data;
      if (body?.code === 'ACCOUNT_LOCKED') {
        const lockedUntil = Date.now() + (body.retry_after_seconds || 0) * 1000;
        startCountdown(lockedUntil);
        setError(t('auth.accountLocked', { min: Math.ceil((body.retry_after_seconds || 0) / 60) }));
      } else {
        const remaining = body?.attempts_remaining;
        setRateStateLocal({ count: remaining != null ? MAX_ATTEMPTS - remaining : 0, lockedUntil: 0 });
        setError(`${t('auth.invalidCredentials')}${remaining != null && remaining <= (MAX_ATTEMPTS - WARN_AFTER) ? ` ${t('auth.attemptsRemaining', { n: remaining })}` : ''}`);
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
        <AuthCard>
          <p className="text-[11px] font-mono uppercase tracking-wider text-ocean-500 mb-2">
            {t('auth.forgotEyebrow')}
          </p>
          <h1 className="font-display font-bold text-lg text-n-900 mb-1">{t('auth.forgotTitle')}</h1>
          <p className="text-xs font-body text-n-500 mb-5">
            {t('auth.forgotSubtitle')}
          </p>
          <form onSubmit={handleForgot} className="space-y-4">
            <Input
              label={t('auth.email')} type="email" placeholder="nome@email.com"
              value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
              required autoComplete="email"
            />
            {error && (
              <div className="px-3 py-2 rounded-sm bg-red-50 text-error text-sm font-body">{error}</div>
            )}
            <Button type="submit" loading={loading} className="w-full">
              {t('auth.sendRecoveryLink')}
            </Button>
          </form>
          <button onClick={() => setMode('login')}
            className="mt-4 text-xs font-body text-ocean-700 hover:underline w-full text-center">
            {t('auth.backToLogin')}
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
              <p className="font-display font-bold text-base text-n-900">{t('auth.emailSentTitle')}</p>
              <p className="text-sm font-body text-n-500 mt-1">
                {(() => {
                  const [before, after] = t('auth.emailSentBody').split('{{email}}');
                  return <>{before}<span className="font-semibold text-n-700">{forgotEmail}</span>{after}</>;
                })()}
              </p>
            </div>
            <p className="text-xs font-body text-n-400">
              {t('auth.checkSpam')}
            </p>
            <button onClick={() => { setMode('login'); setForgotEmail(''); }}
              className="text-sm font-body font-semibold text-ocean-700 hover:underline">
              {t('auth.backToLogin')}
            </button>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  /* ── Login mode ── */
  return (
    <AuthLayout>
      <AuthCard>
        <p className="text-[11px] font-mono uppercase tracking-wider text-ocean-500 mb-2">
          {t('auth.loginSubtitle')}
        </p>
        <h1 className="font-display font-bold text-lg text-n-900 mb-5">
          {t('auth.loginTitle')}
        </h1>

        {/* Success banners */}
        {registeredOk && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[#ECFDF5] border border-green-200 text-[#1A7A4A] text-sm font-body">
            {t('auth.registeredSuccess')}
          </div>
        )}
        {resetOk && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[#ECFDF5] border border-green-200 text-[#1A7A4A] text-sm font-body">
            {t('auth.resetSuccess')}
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
            <span>{t('auth.attemptsWarning', { n: MAX_ATTEMPTS - attemptsUsed })}</span>
          </div>
        )}

        {/* Lockout countdown */}
        {locked && countdown > 0 && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 border border-red-200 text-error text-sm font-body text-center">
            <p className="font-semibold">{t('auth.accessBlocked')}</p>
            <p className="text-xs mt-0.5">{t('auth.tryAgainIn')} <span className="font-mono font-bold">{formatCountdown(countdown)}</span></p>
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
                className="w-full h-10 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-sand-300 focus:border-ocean-700 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-ocean-700 transition-colors">
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
              <span className="text-xs font-body text-n-600">{t('auth.rememberDevice')}</span>
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
        <div className="mt-6 pt-4 border-t border-n-100 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-n-50 text-n-400">
            <Shield size={12} strokeWidth={1.75} />
            <span className="text-[10px] font-mono uppercase tracking-wider">{t('auth.sslSecure')}</span>
          </span>
        </div>
      </AuthCard>

      <p className="text-center text-sm font-body text-white/80 mt-4">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-white hover:text-sand-300 underline">
          {t('auth.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
