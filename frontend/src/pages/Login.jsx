import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { login } from '../services/authService';
import { useT } from '../i18n';
import Logo from '../components/shared/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LanguageToggle from '../components/shared/LanguageToggle';

export default function Login() {
  const t = useT();
  const { token, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate('/');
  }, [token, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      setAuth(result.access_token, result.user, result.operator);
      navigate(result.operator?.onboarding_complete ? '/' : '/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo size="lg" />
          <p className="text-sm font-body text-n-500">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg border border-n-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display font-semibold text-base text-n-900">{t('auth.loginTitle')}</h1>
            <LanguageToggle />
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)] text-sm font-body">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              placeholder="nome@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-ocean-700 hover:text-ocean-500">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              {t('auth.login')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm font-body text-n-500 mt-4">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-ocean-700 hover:text-ocean-500">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
