import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login } from '../../services/authService';
import useAuthStore from '../../store/authStore';

export default function RegisterForm() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (form.password !== form.confirmPassword) {
      return setErro('As passwords não coincidem');
    }

    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      const { data } = await login(form.email, form.password);
      setAuth(data.access_token, data.user, data.operator);
      navigate('/onboarding');
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome completo</label>
        <input
          type="text"
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
        />
      </div>
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
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
          minLength={6}
        />
      </div>
      <div>
        <label className="label">Confirmar password</label>
        <input
          type="password"
          className="input"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          required
        />
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'A criar conta...' : 'Criar conta'}
      </button>

      <p className="text-center text-sm text-gray-600">
        Já tem conta?{' '}
        <Link to="/login" className="text-primary-500 font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
