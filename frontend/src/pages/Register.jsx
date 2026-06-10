import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, Key, ArrowRight, CheckCircle2 } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { register, login, validateInvite } from '../services/authService';
import { useT } from '../i18n';
import AuthLayout from '../components/auth/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import PasswordStrength, { getPasswordStrength } from '../components/auth/PasswordStrength';

/* Invite-gate feature flag — can be disabled via env */
const INVITE_REQUIRED = import.meta.env.VITE_INVITE_REQUIRED !== 'false';

export default function Register() {
  const t = useT();
  const { token, setAuth } = useAuthStore();
  const navigate = useNavigate();

  /* Invite gate */
  const [inviteCode,    setInviteCode]    = useState('');
  const [inviteValid,   setInviteValid]   = useState(!INVITE_REQUIRED);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError,   setInviteError]   = useState('');

  /* Registration form */
  const [form, setForm]               = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors]           = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPw,  setShowPw]          = useState(false);
  const [showCnf, setShowCnf]         = useState(false);

  useEffect(() => { if (token) navigate('/'); }, [token, navigate]);

  async function handleInviteSubmit(e) {
    e.preventDefault();
    if (!inviteCode.trim()) { setInviteError('Introduz o teu codigo de convite.'); return; }
    setInviteError('');
    setInviteLoading(true);
    try {
      const result = await validateInvite(inviteCode.trim().toUpperCase());
      if (result?.data?.valid) {
        setInviteValid(true);
      } else {
        setInviteError('Codigo invalido ou expirado. Verifica o codigo e tenta novamente.');
      }
    } catch {
      setInviteError('Codigo invalido ou expirado. Verifica o codigo e tenta novamente.');
    } finally {
      setInviteLoading(false);
    }
  }

  function validate() {
    const errs = {};
    if (!form.name.trim())    errs.name = t('common.required');
    if (!form.email.trim())   errs.email = t('common.required');
    if (getPasswordStrength(form.password) < 2) {
      errs.password = 'A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.';
    }
    if (form.password !== form.confirm) errs.confirm = 'Passwords nao coincidem';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setServerError(''); setLoading(true);
    try {
      await register(form.name, form.email, form.password, inviteCode.trim().toUpperCase() || undefined);
      const { access_token, user, operator } = await login(form.email, form.password);
      setAuth(access_token, user, operator);
      navigate('/onboarding');
    } catch (err) {
      setServerError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  const set = field => e => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-lg p-6">

        {/* ── Invite gate ── */}
        {!inviteValid ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-ocean-50 rounded-sm flex items-center justify-center shrink-0">
                <Key size={18} strokeWidth={1.75} className="text-ocean-700" />
              </div>
              <div>
                <h1 className="font-display font-bold text-base text-n-900">Acesso por convite</h1>
                <p className="text-xs font-body text-n-500 mt-0.5">
                  A SalDesk esta em fase de lançamento. Necessitas de um codigo de convite.
                </p>
              </div>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                  Codigo de convite
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Ex: SALDESK2026"
                  autoComplete="off"
                  autoFocus
                  className={`w-full h-9 px-3 rounded-sm border text-sm font-mono uppercase bg-n-100 text-n-900 placeholder:text-n-400 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors ${inviteError ? 'border-error' : 'border-n-300'}`}
                />
                {inviteError && (
                  <p className="text-xs text-error mt-1">{inviteError}</p>
                )}
              </div>

              <Button type="submit" loading={inviteLoading} icon={ArrowRight} className="w-full">
                Validar codigo
              </Button>
            </form>

            <p className="mt-4 text-center text-xs font-body text-n-400">
              Nao tens codigo?{' '}
              <a href="mailto:hello@saldesk.cv" className="text-ocean-700 hover:underline">
                Pede acesso antecipado
              </a>
            </p>
          </>
        ) : (
          /* ── Registration form ── */
          <>
            {INVITE_REQUIRED && (
              <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-[#ECFDF5] border border-green-200 rounded-sm">
                <CheckCircle2 size={14} strokeWidth={1.75} className="text-[#1A7A4A] shrink-0" />
                <p className="text-xs font-body text-[#1A7A4A]">
                  Codigo <span className="font-mono font-semibold">{inviteCode.toUpperCase()}</span> validado.
                </p>
              </div>
            )}

            <h1 className="font-display font-bold text-base text-n-900 mb-5">{t('auth.registerTitle')}</h1>

            {serverError && (
              <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 text-error text-sm font-body">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label={t('auth.name')} type="text" placeholder="Joao Silva"
                value={form.name} onChange={set('name')} error={errors.name} required />

              <Input label={t('auth.email')} type="email" placeholder="nome@email.com"
                value={form.email} onChange={set('email')} error={errors.email} required autoComplete="email" />

              {/* Password with strength */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
                  {t('auth.password')} <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                    required
                    autoComplete="new-password"
                    className={`w-full h-9 px-3 pr-10 rounded-sm border text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors ${errors.password ? 'border-error' : 'border-n-300'}`}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                    {showPw ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
                {errors.password && <p className="text-xs text-error">{errors.password}</p>}
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
                  {t('auth.confirmPassword')} <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCnf ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={set('confirm')}
                    required
                    autoComplete="new-password"
                    className={`w-full h-9 px-3 pr-10 rounded-sm border text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors ${errors.confirm ? 'border-error' : 'border-n-300'}`}
                  />
                  <button type="button" onClick={() => setShowCnf(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                    {showCnf ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
                {errors.confirm && <p className="text-xs text-error">{errors.confirm}</p>}
              </div>

              <Button type="submit" loading={loading} className="w-full">
                {t('auth.register')}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-n-100 flex items-center justify-center gap-1.5 text-n-400">
              <Shield size={12} strokeWidth={1.75} />
              <span className="text-[11px] font-mono uppercase tracking-wider">Ligacao segura SSL</span>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-sm font-body text-white/80 mt-4">
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="font-semibold text-white hover:text-sand-300 underline">
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
