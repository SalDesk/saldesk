import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import useAuthStore from '../store/authStore';

export default function Login() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/');
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500">SalDesk</h1>
          <p className="text-gray-500 mt-1">Gestão Turística · Ilha do Sal</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Entrar na conta</h2>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
