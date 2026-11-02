import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, ExternalLink, Lock, ChevronDown } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import usePlan from '../../hooks/usePlan';
import { useNavCounters } from '../../hooks/useNavCounters';
import { UpgradeModal } from '../PlanGuard';
import Logo from '../shared/Logo';
import { PLAN_BADGE, getNavSections, isLocked, sectionIdOfPath } from './navConfig';

/* Ancoras para o WelcomeTour (ver components/tour/WelcomeTour.jsx) --
   so os 5 routes partilhados por TODOS os tipos de operador entram aqui,
   nunca algo especifico de um so tipo. */
const TOUR_ANCHOR = {
  '/':           'nav-dashboard',
  '/unidades':   'nav-unidades',
  '/reservas':   'nav-reservas',
  '/financeiro': 'nav-financeiro',
  '/definicoes': 'nav-definicoes',
};

/* Pilula vermelha do contador (9+ acima de 9) */
function CounterPill({ value }) {
  return (
    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-body font-bold leading-[18px] text-center shrink-0">
      {value > 9 ? '9+' : value}
    </span>
  );
}

export default function Sidebar({ onClose }) {
  const operator = useAuthStore((s) => s.operator);
  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const setNavSectionCollapsed = useUiStore((s) => s.setNavSectionCollapsed);
  const { canAccess } = usePlan();
  const { pathname } = useLocation();
  const counters = useNavCounters();
  const [upgradeModal, setUpgradeModal] = useState(null); // { plan, feature }

  const opType    = operator?.operator_type || 'hotel';
  const sections  = getNavSections(opType);
  const slug      = operator?.slug;
  const lang      = operator?.language || 'pt';
  const siteLabel = lang === 'en' ? 'View my site' : 'Ver o meu site';
  const activeSectionId = sectionIdOfPath(sections, pathname);

  /* Estado efetivo: substituicao explicita ou defaultCollapsed; a seccao da rota ativa abre sempre */
  function isCollapsed(section) {
    if (section.id === activeSectionId) return false;
    return navCollapsed[section.id] ?? section.defaultCollapsed;
  }

  function renderItem(item) {
    const { to, icon: Icon, label, end, requiredPlan, feature } = item;
    const count = counters?.[to] || 0;

    if (isLocked(item, canAccess)) {
      const badge = PLAN_BADGE[requiredPlan];
      return (
        <button
          key={to}
          type="button"
          onClick={() => setUpgradeModal({ plan: requiredPlan, feature })}
          className="w-full flex items-center gap-3 pl-3 pr-3 py-2 rounded-r-md border-l-[3px] border-transparent text-sm font-body font-medium text-ocean-300/70 hover:bg-ocean-700/50 hover:text-ocean-200 transition-colors"
        >
          <Icon size={17} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate flex-1 text-left">{label}</span>
          {badge && (
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          <Lock size={12} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        </button>
      );
    }

    return (
      <NavLink
        key={to}
        to={to}
        end={end}
        data-tour={TOUR_ANCHOR[to]}
        className={({ isActive }) =>
          `flex items-center gap-3 pl-3 pr-3 py-2 rounded-r-md border-l-[3px] text-sm font-body font-medium transition-colors ${
            isActive
              ? 'bg-ocean-600 text-white border-sand-500'
              : 'text-ocean-200 border-transparent hover:bg-ocean-700/60 hover:text-white'
          }`
        }
      >
        <Icon size={17} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate flex-1">{label}</span>
        {count > 0 && <CounterPill value={count} />}
      </NavLink>
    );
  }

  return (
    <aside className="w-60 bg-ocean-800 text-white flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-ocean-700">
        <Logo white size="lg" />
        {onClose && (
          <button onClick={onClose} className="md:hidden text-ocean-300 hover:text-white p-1" aria-label="Fechar">
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Info operador */}
      {operator?.name && (
        <div className="px-4 py-3 border-b border-ocean-700 flex items-center gap-3">
          {operator.logo_url ? (
            <img src={operator.logo_url} alt={operator.name} className="w-8 h-8 rounded-full object-cover shrink-0 bg-ocean-700" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-ocean-600 flex items-center justify-center shrink-0 text-xs font-display font-bold">
              {operator.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-display font-semibold text-white truncate">{operator.name}</p>
            <p className="text-[10px] text-ocean-300 uppercase tracking-wide">{opType}</p>
          </div>
        </div>
      )}

      {/* Nav agrupada por seccoes */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 sidebar-scroll">
        {sections.map((section) => {
          const collapsed = isCollapsed(section);
          /* Seccao da rota ativa fica fixa aberta: o cabecalho nao grava estado */
          const pinned = section.id === activeSectionId;
          const listId = `nav-sec-${section.id}`;
          return (
            <div key={section.id} className="mb-2">
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={listId}
                aria-disabled={pinned ? 'true' : undefined}
                onClick={() => { if (!pinned) setNavSectionCollapsed(section.id, !collapsed); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-display font-semibold tracking-wide text-ocean-300 transition-colors ${pinned ? 'cursor-default' : 'hover:text-white'}`}
              >
                <span>{section.label}</span>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                />
              </button>
              {!collapsed && (
                <div id={listId} className="mt-0.5 space-y-0.5">
                  {section.items.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Upgrade modal (aberto a partir dos itens bloqueados) */}
      {upgradeModal && (
        <UpgradeModal
          plan={upgradeModal.plan}
          feature={upgradeModal.feature}
          onClose={() => setUpgradeModal(null)}
        />
      )}

      {/* Rodape */}
      {slug && (
        <div className="px-2 py-3 border-t border-ocean-700">
          <a
            href={`https://app.saldesk.cv/book/${slug}`}
            target="_blank"
            rel="noreferrer"
            data-tour="nav-site"
            className="flex items-center gap-3 pl-3 pr-3 py-2 rounded-r-md border-l-[3px] border-transparent text-sm font-body font-medium text-sand-300 hover:bg-ocean-700/60 hover:border-sand-500/40 transition-colors"
          >
            <ExternalLink size={17} strokeWidth={1.75} className="shrink-0" />
            <span>{siteLabel}</span>
          </a>
        </div>
      )}
    </aside>
  );
}
