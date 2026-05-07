import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { register } from '../services/authService';
import { useT } from '../i18n';
import Logo from '../components/shared/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LanguageToggle from '../components/shared/LanguageToggle';

export default function Register() {
  const t = useT();
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate('/');
  }, [token, navigate]);

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = t('common.required');
    if (!form.email.trim()) errs.email = t('common.required');
    if (form.password.length < 6) errs.password = 'Minimo 6 caracteres';
    if (form.password !== form.confirm) errs.confirm = 'Passwords nao coincidem';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setServerError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/login?registered=1');
    } catch (err) {
      setServerError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo size="lg" />
          <p className="text-sm font-body text-n-500">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg border border-n-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display font-semibold text-base text-n-900">{t('auth.registerTitle')}</h1>
            <LanguageToggle />
          </div>

          {serverError && (
            <div className="mb-4 px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)] text-sm font-body">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.name')}
              type="text"
              placeholder="Joao Silva"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              required
            />
            <Input
              label={t('auth.email')}
              type="email"
              placeholder="nome@email.com"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              required
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              required
              autoComplete="new-password"
            />
            <Input
              label={t('auth.confirmPassword')}
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set('confirm')}
              error={errors.confirm}
              required
              autoComplete="new-password"
            />

            <Button type="submit" loading={loading} className="w-full">
              {t('auth.register')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm font-body text-n-500 mt-4">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-ocean-700 hover:text-ocean-500">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
