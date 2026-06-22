import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Plus, MessageCircle, User } from 'lucide-react';

const ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/reservas',  icon: Calendar,        label: 'Reservas'            },
];

const ITEMS_RIGHT = [
  { to: '/mensagens', icon: MessageCircle, label: 'Mensagens' },
  { to: '/perfil',    icon: User,          label: 'Perfil'    },
];

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-body font-medium transition-colors ${
          isActive ? 'text-white' : 'text-ocean-300 hover:text-ocean-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-sand-500" />
          )}
          <Icon size={20} strokeWidth={1.75} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav({ onOpenMore }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ocean-900 border-t border-ocean-800 flex items-stretch h-16"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITEMS.map(item => <NavItem key={item.to} {...item} />)}

      <div className="flex-1 flex items-center justify-center">
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="Mais opcoes"
          className="-translate-y-3 w-14 h-14 rounded-full bg-sand-500 shadow-lg flex items-center justify-center hover:bg-sand-600 transition-colors"
        >
          <Plus size={26} strokeWidth={1.75} className="text-white" />
        </button>
      </div>

      {ITEMS_RIGHT.map(item => <NavItem key={item.to} {...item} />)}
    </nav>
  );
}
