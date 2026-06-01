import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays,
  Users, UserCheck, UsersRound, BarChart2,
  Star, MessageCircle, Globe, Megaphone, Settings,
  LogOut, X, ExternalLink, User,
  Compass, Hotel, Car, Truck, UtensilsCrossed, ChefHat, Wrench,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Logo from '../shared/Logo';

const TYPE_NAV = {
  activity: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',         end: true },
    { to: '/unidades',      icon: Compass,         label: 'Tours & Actividades'          },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                     },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'                   },
    { to: '/guias',         icon: Users,           label: 'Guias'                        },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                     },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores'                },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'                   },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'                   },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'                    },
    { to: '/integracoes',   icon: Globe,           label: 'Channel Manager'              },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing'                    },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'                   },
  ],
  hotel: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
    { to: '/unidades',      icon: Hotel,           label: 'Quartos'                 },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'              },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores'           },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'              },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'              },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'               },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing'               },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'              },
  ],
  rentacar: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
    { to: '/frota',         icon: Car,             label: 'Frota'                   },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'              },
    { to: '/manutencao',    icon: Wrench,          label: 'Manutencao'              },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores'           },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'              },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'              },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'               },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing'               },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'              },
  ],
  restaurant: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
    { to: '/unidades',      icon: UtensilsCrossed, label: 'Mesas'                   },
    { to: '/menu',          icon: ChefHat,         label: 'Menu'                    },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'              },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores'           },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'              },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'              },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'               },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing'               },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'              },
  ],
};

export default function Sidebar({ onClose }) {
  const { operator, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  const opType   = operator?.operator_type || 'hotel';
  const navItems = TYPE_NAV[opType] || TYPE_NAV.hotel;
  const slug     = operator?.booking_link_slug;
  const lang     = operator?.language || 'pt';
  const siteLabel = lang === 'en' ? 'View my site' : 'Ver o meu site';

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
            <img src={operator.logo_url} alt={operator.name} className="w-8 h-8 rounded-full object-cover shrink-0 bg-ocean-800" />
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
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium transition-colors ${
                isActive ? 'bg-ocean-700 text-white' : 'text-ocean-200 hover:bg-ocean-800 hover:text-white'
              }`
            }
          >
            <Icon size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-ocean-800 space-y-0.5">
        {slug && (
          <a
            href={`https://app.saldesk.cv/book/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium text-sand-300 hover:bg-ocean-800 hover:text-sand-300 transition-colors"
          >
            <ExternalLink size={17} strokeWidth={1.75} className="shrink-0" />
            <span>{siteLabel}</span>
          </a>
        )}
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium transition-colors ${
              isActive ? 'bg-ocean-700 text-white' : 'text-ocean-300 hover:bg-ocean-800 hover:text-white'
            }`
          }
        >
          <User size={17} strokeWidth={1.75} className="shrink-0" />
          Perfil
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium text-ocean-400 hover:bg-ocean-800 hover:text-white transition-colors"
        >
          <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
}
