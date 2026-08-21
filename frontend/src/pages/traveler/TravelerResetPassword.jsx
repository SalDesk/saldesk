import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { resetPassword } from '../../services/travelerAuthService';
import TravelerAuthLayout from '../../components/traveler/TravelerAuthLayout';
import Button from '../../components/ui/Button';
import PasswordStrength, { getPasswordStrength } from '../../components/auth/PasswordStrength';

export default function TravelerResetPassword() {
  const navigate = useNavigate();
  const [token,    setToken]   = useState('');
  const [form,     setForm]    = useState({ newPw: '', confirm: '' });
  const [showPw,   setShowPw]  = useState(false);
  const [showCnf,  setShowCnf] = useState(false);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [invalid,  setInvalid] = useState(false);

  useEffect(() => {
    const hash   = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const t      = params.get('access_token');
    const type   = params.get('type');
    if (!t || type !== 'recovery') {
      setInvalid(true);
    } else {
      setToken(t);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (getPasswordStrength(form.newPw) < 2) {
      setError('A password deve ser forte: 8+ caracteres, maiuscula, numero e caracter especial.');
      return;
    }
    if (form.newPw !== form.confirm) {
      setError('As passwords nao coincidem.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, form.newPw);
      navigate('/viajante/entrar?reset=1');
    } catch (err) {
      setError(err?.response?.data?.error || 'Link expirado ou invalido. Solicite um novo link de recuperacao.');
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <TravelerAuthLayout>
        <div className="bg-white rounded-3xl shadow-xl shadow-ocean-900/10 p-7 text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={22} strokeWidth={1.75} className="text-error" />
          </div>
          <div>
            <p className="font-display font-bold text-base text-n-900">Link invalido ou expirado</p>
            <p className="text-sm font-body text-n-500 mt-1">
              Este link de recuperacao ja nao e valido. Solicite um novo.
            </p>
          </div>
          <button onClick={() => navigate('/viajante/entrar')}
            className="text-sm font-body font-semibold text-ocean-700 hover:underline">
            Voltar ao login
          </button>
        </div>
      </TravelerAuthLayout>
    );
  }

  return (
    <TravelerAuthLayout>
      <div className="bg-white rounded-3xl shadow-xl shadow-ocean-900/10 p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-ocean-50 rounded-sm flex items-center justify-center shrink-0">
            <Lock size={18} strokeWidth={1.75} className="text-ocean-700" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base text-n-900">Nova password</h1>
            <p className="text-xs font-body text-n-500">Escolha uma password forte para a sua conta.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
              Nova password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.newPw}
                onChange={e => setForm(p => ({ ...p, newPw: e.target.value }))}
                required
                autoComplete="new-password"
                className="w-full h-9 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                {showPw ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
              </button>
            </div>
            <PasswordStrength password={form.newPw} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
              Confirmar password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type={showCnf ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                required
                autoComplete="new-password"
                className="w-full h-9 px-3 pr-10 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white transition-colors"
              />
              <button type="button" onClick={() => setShowCnf(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-400 hover:text-n-600 transition-colors">
                {showCnf ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
              </button>
            </div>
            {form.confirm && form.newPw !== form.confirm && (
              <p className="text-xs text-error">As passwords nao coincidem.</p>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 rounded-sm bg-red-50 border border-red-200 text-error text-sm font-body flex items-start gap-2">
              <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" icon={Lock}>
            Repor password
          </Button>
        </form>
      </div>
    </TravelerAuthLayout>
  );
}
