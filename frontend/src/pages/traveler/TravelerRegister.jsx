import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield } from 'lucide-react';
import useTravelerAuthStore from '../../store/travelerAuthStore';
import { register } from '../../services/travelerAuthService';
import AuthLayout from '../../components/auth/AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import PasswordStrength, { getPasswordStrength } from '../../components/auth/PasswordStrength';

export default function TravelerRegister() {
  const { token } = useTravelerAuthStore();
  const navigate = useNavigate();

  const [form, setForm]               = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors]           = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPw,  setShowPw]          = useState(false);
  const [showCnf, setShowCnf]         = useState(false);

  useEffect(() => { if (token) navigate('/viajante'); }, [token, navigate]);

  function validate() {
    const errs = {};
    if (!form.name.trim())  errs.name = 'Obrigatorio';
    if (!form.email.trim()) errs.email = 'Obrigatorio';
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
      await register(form.name, form.email, form.password, form.phone || undefined);
      navigate('/viajante/entrar?registered=1');
    } catch (err) {
      setServerError(err.response?.data?.error || 'Nao foi possivel criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  const set = field => e => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="font-display font-bold text-base text-n-900 mb-1">Criar conta de viajante</h1>
        <p className="text-xs font-body text-n-500 mb-5">
          Para gerir as suas reservas e guardar experiencias favoritas na Ilha do Sal.
        </p>

        {serverError && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-red-50 text-error text-sm font-body">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome" type="text" placeholder="Joao Silva"
            value={form.name} onChange={set('name')} error={errors.name} required />

          <Input label="Email" type="email" placeholder="nome@email.com"
            value={form.email} onChange={set('email')} error={errors.email} required autoComplete="email" />

          <Input label="Telefone (opcional)" type="tel" placeholder="+238 900 0000"
            value={form.phone} onChange={set('phone')} autoComplete="tel" />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
              Password <span className="text-error">*</span>
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
              Confirmar password <span className="text-error">*</span>
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
            Criar conta
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-n-100 flex items-center justify-center gap-1.5 text-n-400">
          <Shield size={12} strokeWidth={1.75} />
          <span className="text-[11px] font-mono uppercase tracking-wider">Ligacao segura SSL</span>
        </div>
      </div>

      <p className="text-center text-sm font-body text-white/80 mt-4">
        Ja tem conta?{' '}
        <Link to="/viajante/entrar" className="font-semibold text-white hover:text-sand-300 underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
