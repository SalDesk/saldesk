import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, AlertTriangle, Lock, Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import useAuthStore, { setRememberDevice } from '../store/authStore';
import { login, forgotPassword } from '../services/authService';
import { isVendedor, isStaff } from '../utils/userRoles';
import { useT } from '../i18n';
import { BEACH_IMAGES } from '../components/auth/AuthLayout';
import LanguageToggle from '../components/shared/LanguageToggle';
import Logo from '../components/shared/Logo';
import Button from '../components/ui/Button';

/* ── Cena imersiva exclusiva do Login ──
   Ao contrario do AuthLayout partilhado (Register/Onboarding/ResetPassword --
   painel dividido em fundo branco), esta pagina pede um estilo proprio:
   foto a ecran inteiro com um cartao "glass" flutuante por cima. Fica
   local a este ficheiro para nao alterar as outras paginas que ainda usam
   o layout dividido. */
function GlassAuthShell({ children }) {
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => setImgIdx(i => (i + 1) % BEACH_IMAGES.length), 6000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-ocean-900">
      {BEACH_IMAGES.map((src, i) => (
        <div
          key={src}
          className="fixed inset-0 bg-cover bg-center transition-opacity duration-[1500ms]"
          style={{ backgroundImage: `url(${src})`, opacity: i === imgIdx ? 1 : 0 }}
        />
      ))}
      {/* Vinheta escura -- garante que o texto fora do cartao (logo, toggle,
          rodape) fica sempre legivel, seja qual for a foto em exibicao. */}
      <div className="fixed inset-0 bg-gradient-to-br from-ocean-900/80 via-ocean-900/45 to-ocean-900/85" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,42,56,0.15),rgba(6,42,56,0.7)_75%)]" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex items-center justify-between px-6 sm:px-10 py-6">
          <Logo size="md" white />
          <LanguageToggle authMode variant="white" />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-[420px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl shadow-black/20 p-7 sm:p-9">
            {children}
          </div>
        </div>

        <div className="pb-7 px-6">
          <p className="text-center text-xs text-white/50">
            Powered by <span className="text-white/70 font-semibold">WANDR — Travel Technology Company</span>
          </p>
        </div>
      </div>
    </div>
  );
}

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

/* Wrapper identidade reutilizado nos 3 modos (login / forgot / forgot-sent)
   -- a marca ja aparece no cabecalho do GlassAuthShell acima, nao precisa
   de repetir logo aqui dentro do cartao. */
function AuthCard({ children }) {
  return <div>{children}</div>;
}

/* Campo de auth com icone embutido, em vidro fosco -- pensado para
   assentar directamente sobre uma foto (ao contrario do Input.jsx
   generico, opaco, feito para paineis internos). `right` aceita um no
   extra (ex: o botao de mostrar/ocultar password) do lado direito. */
function AuthField({ icon: Icon, right, error, className = '', ...props }) {
  return (
    <div className="relative">
      <Icon size={17} strokeWidth={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
      <input
        {...props}
        className={[
          'w-full h-12 pl-11 rounded-xl border text-sm font-body bg-white/10 text-white',
          'placeholder:text-white/40 transition-all backdrop-blur-sm',
          'focus:outline-none focus:ring-4 focus:ring-white/15 focus:border-white/50 focus:bg-white/15',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          right ? 'pr-11' : 'pr-3.5',
          error ? 'border-red-300/60' : 'border-white/20',
          className,
        ].join(' ')}
      />
      {right}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="text-xs font-body font-bold uppercase tracking-wide text-white/60 mb-1.5 block">
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
      <GlassAuthShell>
        <AuthCard>
          <p className="text-[11px] font-mono uppercase tracking-wider text-white/60 mb-2.5 flex items-center gap-2">
            <span className="w-4 h-px bg-sand-400" />
            {t('auth.forgotEyebrow')}
          </p>
          <h1 className="font-display font-bold text-2xl text-white mb-1.5 tracking-tight">{t('auth.forgotTitle')}</h1>
          <p className="text-sm font-body text-white/60 mb-7 leading-relaxed">
            {t('auth.forgotSubtitle')}
          </p>
          <form onSubmit={handleForgot} className="space-y-5">
            <div>
              <FieldLabel>{t('auth.email')}</FieldLabel>
              <AuthField
                icon={Mail} type="email" placeholder="nome@email.com"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-400/15 border border-red-300/30 text-red-50 text-sm font-body">{error}</div>
            )}
            <Button type="submit" loading={loading} variant="accent" size="lg" className="w-full rounded-xl shadow-lg shadow-black/20 text-[15px]" iconRight={ArrowRight}>
              {t('auth.sendRecoveryLink')}
            </Button>
          </form>
          <button onClick={() => setMode('login')}
            className="mt-6 text-sm font-body font-semibold text-white/70 hover:text-white w-full text-center transition-colors">
            {t('auth.backToLogin')}
          </button>
        </AuthCard>
      </GlassAuthShell>
    );
  }

  if (mode === 'forgot-sent') {
    return (
      <GlassAuthShell>
        <AuthCard>
          <div className="text-center space-y-5 py-2">
            <div className="w-14 h-14 bg-emerald-400/15 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-400/10">
              <Shield size={24} strokeWidth={1.75} className="text-emerald-300" />
            </div>
            <div>
              <p className="font-display font-bold text-xl text-white tracking-tight">{t('auth.emailSentTitle')}</p>
              <p className="text-sm font-body text-white/60 mt-2 leading-relaxed">
                {(() => {
                  const [before, after] = t('auth.emailSentBody').split('{{email}}');
                  return <>{before}<span className="font-semibold text-white/90">{forgotEmail}</span>{after}</>;
                })()}
              </p>
            </div>
            <p className="text-xs font-body text-white/40">
              {t('auth.checkSpam')}
            </p>
            <button onClick={() => { setMode('login'); setForgotEmail(''); }}
              className="text-sm font-body font-semibold text-white/70 hover:text-white transition-colors">
              {t('auth.backToLogin')}
            </button>
          </div>
        </AuthCard>
      </GlassAuthShell>
    );
  }

  /* ── Login mode ── */
  return (
    <GlassAuthShell>
      <AuthCard>
        <p className="text-[11px] font-mono uppercase tracking-wider text-white/60 mb-2.5 flex items-center gap-2">
          <span className="w-4 h-px bg-sand-400" />
          {t('auth.loginSubtitle')}
        </p>
        <h1 className="font-display font-bold text-2xl lg:text-[28px] text-white mb-7 tracking-tight">
          {t('auth.loginTitle')}
        </h1>

        {/* Success banners */}
        {registeredOk && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-400/15 border border-emerald-300/30 text-emerald-50 text-sm font-body">
            {t('auth.registeredSuccess')}
          </div>
        )}
        {resetOk && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-400/15 border border-emerald-300/30 text-emerald-50 text-sm font-body">
            {t('auth.resetSuccess')}
          </div>
        )}

        {/* Error / lockout */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-400/15 border border-red-300/30 text-red-50 text-sm font-body flex items-start gap-2.5">
            <AlertTriangle size={15} strokeWidth={1.75} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Attempts warning */}
        {showWarn && !error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-amber-400/15 border border-amber-300/30 text-amber-50 text-sm font-body flex items-start gap-2.5">
            <AlertTriangle size={15} strokeWidth={1.75} className="shrink-0 mt-0.5" />
            <span>{t('auth.attemptsWarning', { n: MAX_ATTEMPTS - attemptsUsed })}</span>
          </div>
        )}

        {/* Lockout countdown */}
        {locked && countdown > 0 && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-400/15 border border-red-300/30 text-red-50 text-sm font-body text-center">
            <p className="font-semibold">{t('auth.accessBlocked')}</p>
            <p className="text-xs mt-0.5">{t('auth.tryAgainIn')} <span className="font-mono font-bold">{formatCountdown(countdown)}</span></p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <FieldLabel>{t('auth.email')}</FieldLabel>
            <AuthField
              icon={Mail} type="email" placeholder="nome@email.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required autoComplete="email"
              disabled={locked}
            />
          </div>

          {/* Password with show/hide */}
          <div>
            <FieldLabel>{t('auth.password')}</FieldLabel>
            <AuthField
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-ocean-700 transition-colors">
                  {showPw
                    ? <EyeOff size={16} strokeWidth={1.75} />
                    : <Eye    size={16} strokeWidth={1.75} />}
                </button>
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-0.5">
            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 accent-sand-500 rounded shrink-0" />
              <span className="text-sm font-body text-white/70 whitespace-nowrap">{t('auth.rememberDevice')}</span>
            </label>

            <button
              type="button"
              onClick={() => { setMode('forgot'); setForgotEmail(form.email); setError(''); }}
              className="text-sm font-body font-medium text-white/80 hover:text-white shrink-0 transition-colors">
              {t('auth.forgotPassword')}
            </button>
          </div>

          <Button type="submit" loading={loading} disabled={locked} variant="accent" size="lg" className="w-full rounded-xl shadow-lg shadow-black/20 text-[15px]" icon={Lock}>
            {t('auth.login')}
          </Button>
        </form>

        {/* SSL badge */}
        <div className="mt-7 pt-5 border-t border-white/15 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/50">
            <Shield size={12} strokeWidth={1.75} />
            <span className="text-[10px] font-mono uppercase tracking-wider">{t('auth.sslSecure')}</span>
          </span>
        </div>

        <p className="text-center text-sm font-body text-white/70 mt-6">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-white hover:text-sand-300 underline underline-offset-2 transition-colors">
            {t('auth.register')}
          </Link>
        </p>
      </AuthCard>
    </GlassAuthShell>
  );
}
