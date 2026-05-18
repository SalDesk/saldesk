import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { login } from '../services/authService';
import { useT } from '../i18n';
import AuthLayout from '../components/auth/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

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
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="font-display font-bold text-base text-n-900 mb-5">{t('auth.loginTitle')}</h1>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)] text-sm font-body">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('auth.email')} type="email" placeholder="nome@email.com"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            required autoComplete="email" />
          <Input label={t('auth.password')} type="password" placeholder="••••••••"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            required autoComplete="current-password" />

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

      <p className="text-center text-sm font-body text-white/80 mt-4">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-white hover:text-sand-300 underline">
          {t('auth.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
