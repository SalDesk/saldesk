import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, BookOpen, Users, Zap, BarChart2,
  Settings, LogOut, X, UserCheck, MessageCircle, Truck, Star,
  Hotel, Waves, Car, UtensilsCrossed, Package, Puzzle, User,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useT } from '../../i18n';
import Logo from '../shared/Logo';

/* Itens base — todos os operadores */
const BASE_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: { pt: 'Dashboard',  en: 'Dashboard'  }, end: true },
  { to: '/reservas',   icon: BookOpen,        label: { pt: 'Reservas',   en: 'Bookings'   } },
  { to: '/calendario', icon: CalendarDays,    label: { pt: 'Calendario', en: 'Calendar'   } },
  { to: '/clientes',   icon: Users,           label: { pt: 'Clientes',   en: 'Customers'  } },
  { to: '/financeiro', icon: BarChart2,       label: { pt: 'Financeiro', en: 'Financial'  } },
  { to: '/automacoes', icon: Zap,             label: { pt: 'Automacoes', en: 'Automations'} },
  { to: '/avaliacoes', icon: Star,            label: { pt: 'Avaliacoes', en: 'Reviews'    } },
  { to: '/mensagens',  icon: MessageCircle,   label: { pt: 'Mensagens',  en: 'Messages'   } },
];

/* Itens por tipo de operador */
const TYPE_ITEMS = {
  hotel: [
    { to: '/unidades',  icon: Hotel,     label: { pt: 'Quartos',    en: 'Rooms'      } },
  ],
  activity: [
    { to: '/unidades',      icon: Waves,     label: { pt: 'Servicos',       en: 'Services'   } },
    { to: '/colaboradores', icon: UserCheck, label: { pt: 'Guias/Equipa',   en: 'Guides/Team'} },
    { to: '/frota',         icon: Package,   label: { pt: 'Equipamento',    en: 'Equipment'  } },
    { to: '/integracoes',   icon: Puzzle,    label: { pt: 'Integracoes',    en: 'Integrations'} },
  ],
  rentacar: [
    { to: '/unidades',      icon: Car,       label: { pt: 'Frota/Viaturas', en: 'Fleet/Cars' } },
    { to: '/colaboradores', icon: UserCheck, label: { pt: 'Colaboradores',  en: 'Staff'      } },
    { to: '/frota',         icon: Truck,     label: { pt: 'Equipamento',    en: 'Equipment'  } },
  ],
  restaurant: [
    { to: '/unidades',  icon: UtensilsCrossed, label: { pt: 'Mesas/Menus', en: 'Tables/Menus'} },
  ],
};

/* Itens finais — todos */
const END_ITEMS = [
  { to: '/definicoes', icon: Settings, label: { pt: 'Definicoes', en: 'Settings' } },
];

export default function Sidebar({ onClose }) {
  const { operator, logout } = useAuthStore();
  const t   = useT();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  const opType    = operator?.operator_type || 'hotel';
  const typeItems = TYPE_ITEMS[opType] || [];
  const allItems  = [...BASE_ITEMS, ...typeItems, ...END_ITEMS];

  const labelKey = (item) => {
    const lang = document.documentElement.getAttribute('data-lang') || 'pt';
    return item.label?.[lang] || item.label?.pt || '';
  };

  return (
    <aside className="w-64 bg-ocean-900 text-white flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-800">
        <Logo white size="md" />
        {onClose && (
          <button onClick={onClose} className="md:hidden text-ocean-300 hover:text-white p-1" aria-label="Fechar">
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Info operador */}
      {operator?.name && (
        <div className="px-4 py-3 border-b border-ocean-800 flex items-center gap-3">
          {operator.logo_url ? (
            <img src={operator.logo_url} alt={operator.name} className="w-8 h-8 rounded-full object-cover shrink-0 bg-ocean-800"/>
          ) : (
            <div className="w-8 h-8 rounded-full bg-ocean-700 flex items-center justify-center shrink-0 text-xs font-display font-bold">
              {operator.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-display font-semibold text-white truncate">{operator.name}</p>
            <p className="text-[10px] text-ocean-400 uppercase tracking-wide">{opType}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {allItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium transition-colors ${
                isActive ? 'bg-ocean-700 text-white' : 'text-ocean-200 hover:bg-ocean-800 hover:text-white'
              }`
            }
          >
            <Icon size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{labelKey({ label })}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout + Perfil */}
      <div className="px-2 py-3 border-t border-ocean-800 space-y-0.5">
        <NavLink to="/perfil"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium transition-colors ${
              isActive ? 'bg-ocean-700 text-white' : 'text-ocean-300 hover:bg-ocean-800 hover:text-white'
            }`
          }
        >
          <User size={17} strokeWidth={1.75} className="shrink-0" />
          Perfil
        </NavLink>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium text-ocean-400 hover:bg-ocean-800 hover:text-white transition-colors">
          <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  );
}
