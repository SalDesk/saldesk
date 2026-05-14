import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { BarChart2, Users, Star, Megaphone, Layers, CalendarDays, FileText, LogOut, Shield } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Logo from '../shared/Logo';

const navItems = [
  { to: '/admin',           label: 'Dashboard',    icon: BarChart2,    end: true },
  { to: '/admin/operators', label: 'Operadores',   icon: Users },
  { to: '/admin/leads',     label: 'Leads',        icon: Star },
  { to: '/admin/cms/featured',    label: 'Destaques',  icon: Megaphone },
  { to: '/admin/cms/banners',     label: 'Banners',    icon: Layers },
  { to: '/admin/cms/experiences', label: 'Experiencias',icon: Star },
  { to: '/admin/cms/events',      label: 'Eventos',    icon: CalendarDays },
  { to: '/admin/cms/articles',    label: 'Artigos',    icon: FileText },
];

export default function AdminLayout() {
  const { logout } = useAuthStore();
  const navigate   = useNavigate();

  return (
    <div className="flex h-screen bg-n-50 overflow-hidden">
      <aside className="w-56 bg-ocean-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-ocean-800 flex items-center gap-2">
          <Logo white size="sm"/>
          <span className="text-xs font-body font-bold uppercase tracking-wide text-ocean-400 flex items-center gap-1">
            <Shield size={11} strokeWidth={1.75}/> Admin
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body font-medium transition-colors ${isActive ? 'bg-ocean-700 text-white' : 'text-ocean-300 hover:bg-ocean-800 hover:text-white'}`
              }>
              <Icon size={16} strokeWidth={1.75} className="shrink-0"/>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-ocean-800">
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body text-ocean-400 hover:bg-ocean-800 hover:text-white transition-colors mb-1">
            <BarChart2 size={16} strokeWidth={1.75}/> Dashboard gestor
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body text-ocean-400 hover:bg-ocean-800 hover:text-white transition-colors">
            <LogOut size={16} strokeWidth={1.75}/> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet/>
      </main>
    </div>
  );
}
