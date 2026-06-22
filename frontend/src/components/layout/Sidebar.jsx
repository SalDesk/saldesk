import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays,
  Users, UserCheck, UsersRound, BarChart2,
  Star, MessageCircle, Globe, Megaphone, Settings,
  LogOut, X, ExternalLink, User, Lock, Zap,
  Compass, Hotel, Car, Truck, UtensilsCrossed, ChefHat, Wrench,
  Activity, Award, Tag, FileWarning, ThumbsUp, CloudSun, LineChart,
  UserPlus, Users2, Package, Handshake, Sparkles,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import usePlan from '../../hooks/usePlan';
import { UpgradeModal } from '../PlanGuard';
import Logo from '../shared/Logo';

/* requiredPlan: plan gate | feature: key for UpgradeModal description */
export const TYPE_NAV = {
  activity: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',         end: true },
    { to: '/unidades',      icon: Compass,         label: 'Tours & Actividades'          },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                     },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'                   },
    { to: '/guias',         icon: Users,           label: 'Guias',            requiredPlan: 'business', feature: 'guias'          },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                     },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores',    requiredPlan: 'business', feature: 'colaboradores'  },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'                   },
    { to: '/analytics',     icon: Activity,        label: 'Analytics',        requiredPlan: 'business', feature: 'analytics'      },
    { to: '/meteorologia',  icon: CloudSun,        label: 'Meteorologia',     requiredPlan: 'business', feature: 'meteorologia'   },
    { to: '/previsao',      icon: LineChart,       label: 'Previsao',         requiredPlan: 'pro',      feature: 'previsao'       },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'                   },
    { to: '/ocorrencias',   icon: FileWarning,     label: 'Ocorrencias'                  },
    { to: '/feedback',      icon: ThumbsUp,        label: 'Feedback'                     },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'                    },
    { to: '/integracoes',   icon: Globe,           label: 'Channel Manager',  requiredPlan: 'pro',      feature: 'integracoes'    },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing',        requiredPlan: 'business', feature: 'marketing'      },
    { to: '/automacoes',    icon: Zap,             label: 'Automacoes',       requiredPlan: 'pro',      feature: 'automacoes'     },
    { to: '/fidelidade',    icon: Award,           label: 'Fidelidade',       requiredPlan: 'pro',      feature: 'fidelidade'     },
    { to: '/vouchers',      icon: Tag,             label: 'Vouchers',         requiredPlan: 'business', feature: 'vouchers'       },
    { to: '/afiliados',     icon: UserPlus,        label: 'Afiliados',        requiredPlan: 'business', feature: 'afiliados'      },
    { to: '/grupos',        icon: Users2,          label: 'Grupos',           requiredPlan: 'pro',      feature: 'grupos'         },
    { to: '/pacotes',       icon: Package,         label: 'Pacotes',          requiredPlan: 'pro',      feature: 'pacotes'        },
    { to: '/parcerias',     icon: Handshake,       label: 'Parcerias',        requiredPlan: 'pro',      feature: 'parcerias'      },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'                   },
  ],
  hotel: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
    { to: '/unidades',      icon: Hotel,           label: 'Quartos'                 },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'              },
    { to: '/housekeeping',  icon: Sparkles,        label: 'Housekeeping'            },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores',  requiredPlan: 'business', feature: 'colaboradores' },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'              },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'              },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'               },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing',      requiredPlan: 'business', feature: 'marketing'     },
    { to: '/analytics',     icon: Activity,        label: 'Analytics',      requiredPlan: 'business', feature: 'analytics'     },
    { to: '/vouchers',      icon: Tag,             label: 'Vouchers',       requiredPlan: 'business', feature: 'vouchers'      },
    { to: '/afiliados',     icon: UserPlus,        label: 'Afiliados',      requiredPlan: 'business', feature: 'afiliados'     },
    { to: '/automacoes',    icon: Zap,             label: 'Automacoes',     requiredPlan: 'pro',      feature: 'automacoes'    },
    { to: '/fidelidade',    icon: Award,           label: 'Fidelidade',     requiredPlan: 'pro',      feature: 'fidelidade'    },
    { to: '/grupos',        icon: Users2,          label: 'Grupos',         requiredPlan: 'pro',      feature: 'grupos'        },
    { to: '/pacotes',       icon: Package,         label: 'Pacotes',        requiredPlan: 'pro',      feature: 'pacotes'       },
    { to: '/parcerias',     icon: Handshake,       label: 'Parcerias',      requiredPlan: 'pro',      feature: 'parcerias'     },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'              },
  ],
  rentacar: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
    { to: '/unidades',      icon: Car,             label: 'Frota'                   },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'              },
    { to: '/manutencao',    icon: Wrench,          label: 'Manutencao'              },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores',  requiredPlan: 'business', feature: 'colaboradores' },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'              },
    { to: '/analytics',     icon: Activity,        label: 'Analytics',      requiredPlan: 'business', feature: 'analytics'     },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'              },
    { to: '/ocorrencias',   icon: FileWarning,     label: 'Ocorrencias'             },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'               },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing',      requiredPlan: 'business', feature: 'marketing'     },
    { to: '/automacoes',    icon: Zap,             label: 'Automacoes',     requiredPlan: 'pro',      feature: 'automacoes'    },
    { to: '/fidelidade',    icon: Award,           label: 'Fidelidade',     requiredPlan: 'pro',      feature: 'fidelidade'    },
    { to: '/vouchers',      icon: Tag,             label: 'Vouchers',       requiredPlan: 'business', feature: 'vouchers'      },
    { to: '/afiliados',     icon: UserPlus,        label: 'Afiliados',      requiredPlan: 'business', feature: 'afiliados'     },
    { to: '/grupos',        icon: Users2,          label: 'Grupos',         requiredPlan: 'pro',      feature: 'grupos'        },
    { to: '/pacotes',       icon: Package,         label: 'Pacotes',        requiredPlan: 'pro',      feature: 'pacotes'       },
    { to: '/parcerias',     icon: Handshake,       label: 'Parcerias',      requiredPlan: 'pro',      feature: 'parcerias'     },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'              },
  ],
  restaurant: [
    { to: '/',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
    { to: '/unidades',      icon: UtensilsCrossed, label: 'Mesas'                   },
    { to: '/menu-digital',  icon: ChefHat,         label: 'Menu'                    },
    { to: '/reservas',      icon: Calendar,        label: 'Reservas'                },
    { to: '/calendario',    icon: CalendarDays,    label: 'Calendario'              },
    { to: '/clientes',      icon: UserCheck,       label: 'Clientes'                },
    { to: '/colaboradores', icon: UsersRound,      label: 'Colaboradores',  requiredPlan: 'business', feature: 'colaboradores' },
    { to: '/financeiro',    icon: BarChart2,       label: 'Financeiro'              },
    { to: '/avaliacoes',    icon: Star,            label: 'Avaliacoes'              },
    { to: '/mensagens',     icon: MessageCircle,   label: 'Mensagens'               },
    { to: '/marketing',     icon: Megaphone,       label: 'Marketing',      requiredPlan: 'business', feature: 'marketing'     },
    { to: '/analytics',     icon: Activity,        label: 'Analytics',      requiredPlan: 'business', feature: 'analytics'     },
    { to: '/automacoes',    icon: Zap,             label: 'Automacoes',     requiredPlan: 'pro',      feature: 'automacoes'    },
    { to: '/fidelidade',    icon: Award,           label: 'Fidelidade',     requiredPlan: 'pro',      feature: 'fidelidade'    },
    { to: '/vouchers',      icon: Tag,             label: 'Vouchers',       requiredPlan: 'business', feature: 'vouchers'      },
    { to: '/definicoes',    icon: Settings,        label: 'Definicoes'              },
  ],
};

export const PLAN_BADGE = {
  business: { label: 'Business', cls: 'bg-ocean-600 text-white' },
  pro:      { label: 'Pro',      cls: 'bg-sand-500 text-white'   },
};

export default function Sidebar({ onClose }) {
  const { operator, logout } = useAuthStore();
  const navigate = useNavigate();
  const { canAccess } = usePlan();
  const [upgradeModal, setUpgradeModal] = useState(null); // { plan, feature }

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
        {navItems.map(({ to, icon: Icon, label, end, requiredPlan, feature }) => {
          const locked = requiredPlan && !canAccess(feature || requiredPlan);
          const badge  = requiredPlan ? PLAN_BADGE[requiredPlan] : null;

          if (locked) {
            return (
              <button
                key={`${to}-${label}`}
                type="button"
                onClick={() => setUpgradeModal({ plan: requiredPlan, feature })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body font-medium text-ocean-600 hover:bg-ocean-800/50 hover:text-ocean-400 transition-colors"
              >
                <Icon size={17} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate flex-1 text-left">{label}</span>
                {badge && (
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
                <Lock size={12} strokeWidth={1.75} className="shrink-0 text-ocean-600" />
              </button>
            );
          }

          return (
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
              <span className="truncate flex-1">{label}</span>
              {badge && (
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Upgrade modal (triggered from locked items) */}
      {upgradeModal && (
        <UpgradeModal
          plan={upgradeModal.plan}
          feature={upgradeModal.feature}
          onClose={() => setUpgradeModal(null)}
        />
      )}

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
