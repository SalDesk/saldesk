import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, Layers,
  Globe, Server, LogOut, Shield, BarChart2, GitBranch, Euro, MessageSquare,
  Menu, X,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Logo from '../shared/Logo';
import api from '../../services/api';

export default function AdminLayout() {
  const { logout } = useAuthStore();
  const navigate   = useNavigate();
  const [counts,      setCounts]      = useState({ leads: 0, trials: 0 });
  const [mobileOpen,  setMobileOpen]  = useState(false);

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
    { to: '/admin/financeiro-plataforma',  label: 'Financeiro',   icon: Euro },
    { to: '/admin/comunicacoes',            label: 'Comunicacao',  icon: MessageSquare },
    { to: '/admin/analytics-plataforma',  label: 'Analytics',    icon: BarChart2 },
    { to: '/admin/impacto',               label: 'Impacto',      icon: Globe },
    { to: '/admin/sistema',   label: 'Sistema',     icon: Server },
  ];

  return (
    <div className="flex h-screen bg-n-50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={[
        'fixed md:relative z-40 h-full w-56 bg-ocean-900 text-white flex flex-col shrink-0 transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}>
        <div className="px-4 py-4 border-b border-ocean-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo white size="sm" />
            <span className="text-xs font-body font-bold uppercase tracking-wide text-ocean-400 flex items-center gap-1">
              <Shield size={11} strokeWidth={1.75} /> Admin
            </span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-ocean-400 hover:text-white p-1" aria-label="Fechar">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-n-200 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-n-600 hover:text-ocean-700 p-1" aria-label="Menu">
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <span className="text-sm font-display font-bold text-n-900 flex items-center gap-1.5">
            <Shield size={14} strokeWidth={1.75} className="text-ocean-700" /> Admin
          </span>
        </div>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
