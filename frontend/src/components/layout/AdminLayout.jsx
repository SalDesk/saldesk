import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, Layers,
  Globe, Server, LogOut, Shield, BarChart2, GitBranch, Euro,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Logo from '../shared/Logo';
import api from '../../services/api';

export default function AdminLayout() {
  const { logout } = useAuthStore();
  const navigate   = useNavigate();
  const [counts, setCounts] = useState({ leads: 0, trials: 0 });

  useEffect(() => {
    api.get('/admin/stats').then(r => {
      const s = r.data.data;
      setCounts({
        leads:  s?.leads?.new_uncontacted || 0,
        trials: s?.trials_expiring?.length || 0,
      });
    }).catch(() => {});
  }, []);

  const navItems = [
    { to: '/admin',           label: 'Dashboard',   icon: LayoutDashboard, end: true },
    { to: '/admin/operators', label: 'Operadores',  icon: Users,       badge: counts.trials },
    { to: '/admin/leads',     label: 'Leads',       icon: TrendingUp,  badge: counts.leads },
    { to: '/admin/pipeline',  label: 'Pipeline',    icon: GitBranch },
    { to: '/admin/cms',                     label: 'CMS',         icon: Layers },
    { to: '/admin/financeiro-plataforma',  label: 'Financeiro',  icon: Euro },
    { to: '/admin/impacto',               label: 'Impacto',     icon: Globe },
    { to: '/admin/sistema',   label: 'Sistema',     icon: Server },
  ];

  return (
    <div className="flex h-screen bg-n-50 overflow-hidden">
      <aside className="w-56 bg-ocean-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-ocean-800 flex items-center gap-2">
          <Logo white size="sm" />
          <span className="text-xs font-body font-bold uppercase tracking-wide text-ocean-400 flex items-center gap-1">
            <Shield size={11} strokeWidth={1.75} /> Admin
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body font-medium transition-colors ${
                  isActive ? 'bg-ocean-700 text-white' : 'text-ocean-300 hover:bg-ocean-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {!!badge && badge > 0 && (
                <span className="w-5 h-5 rounded-full bg-sand-500 text-ocean-900 text-xs font-bold font-body flex items-center justify-center shrink-0">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-ocean-800 space-y-0.5">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body text-ocean-400 hover:bg-ocean-800 hover:text-white transition-colors"
          >
            <BarChart2 size={16} strokeWidth={1.75} />
            Dashboard gestor
          </button>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-body text-ocean-400 hover:bg-ocean-800 hover:text-white transition-colors"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
