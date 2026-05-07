import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../../services/authService';
import useAuthStore from '../../store/authStore';

export default function LoginForm() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { data } = await login(form.email, form.password);
      setAuth(data.access_token, data.user, data.operator);
      navigate(data.operator?.onboarding_complete ? '/' : '/onboarding');
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoFocus
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password"
          className="input"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'A entrar...' : 'Entrar'}
      </button>

      <p className="text-center text-sm text-gray-600">
        Não tem conta?{' '}
        <Link to="/register" className="text-primary-500 font-medium hover:underline">
          Registar
        </Link>
      </p>
    </form>
  );
}
