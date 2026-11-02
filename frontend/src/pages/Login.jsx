import { useState, useEffect, useRef, useId } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, AlertTriangle, Lock, Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import useAuthStore, { setRememberDevice } from '../store/authStore';
import { login, forgotPassword } from '../services/authService';
import { isVendedor, isStaff } from '../utils/userRoles';
import { useT } from '../i18n';
import AuthLayout from '../components/auth/AuthLayout';
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

/* Campo de auth com icone embutido, em fundo claro -- assenta no cartao
   branco do AuthLayout. `right` aceita um no extra (ex: o botao de
   mostrar/ocultar password) do lado direito. */
function AuthField({ icon: Icon, right, error, className = '', ...props }) {
  return (
    <div className="relative">
      <Icon size={17} strokeWidth={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
      <input
        {...props}
        className={[
          'w-full h-11 pl-11 rounded-sm border text-sm font-body bg-white text-n-900',
          'placeholder:text-n-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-500',
          'disabled:bg-n-50 disabled:opacity-60 disabled:cursor-not-allowed',
          right ? 'pr-11' : 'pr-3.5',
          error ? 'border-red-300' : 'border-n-300',
          className,
        ].join(' ')}
      />
      {right}
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-body font-medium text-n-700 mb-1.5 block">
      {children}
    </label>
  );
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
  /* ids que ligam cada etiqueta ao seu campo (nome acessivel) */
  const emailId       = useId();
  const passwordId    = useId();
  const forgotEmailId = useId();

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
      } else if (body?.code === 'RATE_LIMIT') {
        /* Distinto de credenciais erradas -- isto e o authLimiter do IP
           (partilhado por varios utilizadores atras do mesmo NAT/operadora
           movel), nao uma tentativa falhada desta conta. Mostrar
           "invalidCredentials" aqui enganava fundador/operadores reais a
           pensar que a password estava errada quando o problema era so
           demasiados pedidos vindos da mesma rede. */
        setError(t('auth.rateLimit'));
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
        <h1 className="font-display font-bold text-2xl text-n-900 mb-1.5 tracking-tight">{t('auth.forgotTitle')}</h1>
        <p className="text-sm font-body text-n-600 mb-7 leading-relaxed">
          {t('auth.forgotSubtitle')}
        </p>
        <form onSubmit={handleForgot} className="space-y-5">
          <div>
            <FieldLabel htmlFor={forgotEmailId}>{t('auth.email')}</FieldLabel>
            <AuthField
              id={forgotEmailId}
              icon={Mail} type="email" placeholder="nome@email.com"
              value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>
          {error && (
            <div className="px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-red-800 text-sm font-body">{error}</div>
          )}
          <Button type="submit" loading={loading} variant="accent" size="lg" className="w-full" iconRight={ArrowRight}>
            {t('auth.sendRecoveryLink')}
          </Button>
        </form>
        <button onClick={() => setMode('login')}
          className="mt-6 text-sm font-body font-semibold text-ocean-700 hover:text-ocean-600 w-full text-center transition-colors">
          {t('auth.backToLogin')}
        </button>
      </AuthLayout>
    );
  }

  if (mode === 'forgot-sent') {
    return (
      <AuthLayout>
        <div className="text-center space-y-5 py-2">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/60">
            <Shield size={24} strokeWidth={1.75} className="text-emerald-700" />
          </div>
          <div>
            <p className="font-display font-bold text-xl text-n-900 tracking-tight">{t('auth.emailSentTitle')}</p>
            <p className="text-sm font-body text-n-600 mt-2 leading-relaxed">
              {(() => {
                const [before, after] = t('auth.emailSentBody').split('{{email}}');
                return <>{before}<span className="font-semibold text-n-900">{forgotEmail}</span>{after}</>;
              })()}
            </p>
          </div>
          <p className="text-xs font-body text-n-500">
            {t('auth.checkSpam')}
          </p>
          <button onClick={() => { setMode('login'); setForgotEmail(''); }}
            className="text-sm font-body font-semibold text-ocean-700 hover:text-ocean-600 transition-colors">
            {t('auth.backToLogin')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  /* ── Login mode ── */
  return (
    <AuthLayout>
      <h1 className="font-display font-bold text-2xl lg:text-[28px] text-n-900 mb-7 tracking-tight">
        {t('auth.loginTitle')}
      </h1>

      {/* Success banners */}
      {registeredOk && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-body">
          {t('auth.registeredSuccess')}
        </div>
      )}
      {resetOk && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-body">
          {t('auth.resetSuccess')}
        </div>
      )}

      {/* Error / lockout */}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-red-800 text-sm font-body flex items-start gap-2.5">
          <AlertTriangle size={15} strokeWidth={1.75} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Attempts warning */}
      {showWarn && !error && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-amber-50 border border-amber-200 text-amber-800 text-sm font-body flex items-start gap-2.5">
          <AlertTriangle size={15} strokeWidth={1.75} className="shrink-0 mt-0.5" />
          <span>{t('auth.attemptsWarning', { n: MAX_ATTEMPTS - attemptsUsed })}</span>
        </div>
      )}

      {/* Lockout countdown */}
      {locked && countdown > 0 && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-red-800 text-sm font-body text-center">
          <p className="font-semibold">{t('auth.accessBlocked')}</p>
          <p className="text-xs mt-0.5">{t('auth.tryAgainIn')} <span className="font-mono font-bold">{formatCountdown(countdown)}</span></p>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <FieldLabel htmlFor={emailId}>{t('auth.email')}</FieldLabel>
          <AuthField
            id={emailId}
            icon={Mail} type="email" placeholder="nome@email.com"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            required autoComplete="email"
            disabled={locked}
          />
        </div>

        {/* Password with show/hide */}
        <div>
          <FieldLabel htmlFor={passwordId}>{t('auth.password')}</FieldLabel>
          <AuthField
            id={passwordId}
            icon={Lock}
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            required
            autoComplete="current-password"
            disabled={locked}
            right={
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                aria-label={showPw ? 'Ocultar password' : 'Mostrar password'}
                aria-pressed={showPw}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-ocean-700 transition-colors">
                {showPw
                  ? <EyeOff size={16} strokeWidth={1.75} />
                  : <Eye    size={16} strokeWidth={1.75} />}
              </button>
            }
          />
        </div>

        {/* Lembrar e recuperar password: sempre na mesma linha */}
        <div className="flex items-start justify-between gap-3 pt-0.5">
          {/* Remember me */}
          <label className="flex items-start gap-2 cursor-pointer select-none min-w-0">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-ocean-700 rounded-sm shrink-0" />
            <span className="text-sm font-body text-n-700 leading-snug">{t('auth.rememberDevice')}</span>
          </label>

          <button
            type="button"
            onClick={() => { setMode('forgot'); setForgotEmail(form.email); setError(''); }}
            className="text-sm font-body font-medium text-ocean-700 hover:text-ocean-600 shrink-0 whitespace-nowrap transition-colors">
            {t('auth.forgotPassword')}
          </button>
        </div>

        <Button type="submit" loading={loading} disabled={locked} variant="accent" size="lg" className="w-full" icon={Lock}>
          {t('auth.login')}
        </Button>
      </form>

      {/* SSL: linha de texto discreta */}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs font-body text-n-500">
        <Shield size={12} strokeWidth={1.75} />
        {t('auth.sslSecure')}
      </p>

      <p className="text-center text-sm font-body text-n-600 mt-5">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-ocean-700 hover:text-ocean-600 underline underline-offset-2 transition-colors">
          {t('auth.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
