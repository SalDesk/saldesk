import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, BookOpen, Users,
  Zap, BarChart2, Building2, Puzzle, Settings, LogOut, X,
  UserCheck, MessageCircle, Truck, Star,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import { useT } from '../../i18n';
import Logo from '../shared/Logo';

const navItems = [
  { to: '/',            icon: LayoutDashboard, key: 'nav.dashboard',    end: true },
  { to: '/reservas',    icon: BookOpen,        key: 'nav.reservations' },
  { to: '/calendario',  icon: CalendarDays,    key: 'nav.calendar' },
  { to: '/clientes',    icon: Users,           key: 'nav.customers' },
  { to: '/automacoes',  icon: Zap,             key: 'nav.automations' },
  { to: '/financeiro',  icon: BarChart2,       key: 'nav.financial' },
  { to: '/unidades',      icon: Building2,      key: 'nav.units' },
  { to: '/colaboradores', icon: UserCheck,     label: 'Colaboradores' },
  { to: '/frota',         icon: Truck,         label: 'Frota' },
  { to: '/mensagens',     icon: MessageCircle, label: 'Mensagens' },
  { to: '/avaliacoes',    icon: Star,          label: 'Avaliacoes' },
  { to: '/integracoes',   icon: Puzzle,        key: 'nav.integrations' },
  { to: '/definicoes',    icon: Settings,      key: 'nav.settings' },
];

export default function Sidebar({ onClose }) {
  const { operator, logout } = useAuthStore();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const t = useT();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="w-64 bg-ocean-900 text-white flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between px-5 py-5 border-b border-ocean-800">
        <Logo white />
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-ocean-300 hover:text-white p-1"
            aria-label="Fechar menu"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {operator?.name && (
        <div className="px-5 py-3 border-b border-ocean-800">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-ocean-400">
            {t('nav.dashboard').replace('Dashboard', operator.name)}
          </p>
          <p className="text-[11px] text-ocean-400 mt-0.5 truncate">{operator.name}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, key, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium transition-colors',
                isActive
                  ? 'bg-ocean-700 text-white'
                  : 'text-ocean-200 hover:bg-ocean-800 hover:text-white',
              ].join(' ')
            }
          >
            <Icon size={18} strokeWidth={1.75} className="shrink-0" />
            {label || t(key)}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-ocean-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium text-ocean-300 hover:bg-ocean-800 hover:text-white transition-colors"
        >
          <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  );
}
