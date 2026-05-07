import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/reservas', label: 'Reservas', icon: '📅' },
  { to: '/calendario', label: 'Calendário', icon: '🗓️' },
  { to: '/clientes', label: 'Clientes', icon: '👥' },
  { to: '/automacoes', label: 'Automações', icon: '🤖' },
  { to: '/financeiro', label: 'Financeiro', icon: '💰' },
  { to: '/unidades', label: 'Unidades', icon: '🏠' }
];

export default function Sidebar({ onClose }) {
  const { operator, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="w-64 bg-primary-500 text-white flex flex-col h-full">
      <div className="p-6 border-b border-primary-600 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">SalDesk</h1>
          <p className="text-primary-100 text-sm mt-1 truncate">{operator?.name}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-primary-200 hover:text-white text-xl leading-none mt-0.5">
            ×
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-primary-500'
                  : 'text-primary-100 hover:bg-primary-600'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-600">
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-100 hover:bg-primary-600 transition-colors"
        >
          <span>🚪</span> Terminar sessão
        </button>
      </div>
    </aside>
  );
}
