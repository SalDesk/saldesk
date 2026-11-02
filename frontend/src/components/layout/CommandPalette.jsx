import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Lock } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import usePlan from '../../hooks/usePlan';
import { UpgradeModal } from '../PlanGuard';
import { PLAN_BADGE, filterNavItems, getNavSections, isLocked } from './navConfig';

/* Conteudo da palette: so existe enquanto aberta, por isso o estado
   (pesquisa e selecao) volta ao inicio de cada vez que abre */
function PaletteBody({ onClose }) {
  const operator = useAuthStore((s) => s.operator);
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccess } = usePlan();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [upgradeModal, setUpgradeModal] = useState(null); // { plan, feature }

  const opType = operator?.operator_type || 'hotel';

  /* Seccoes com os itens que passam o filtro; indice plano para o teclado */
  const groups = getNavSections(opType)
    .map((section) => ({ ...section, items: filterNavItems(section.items, query) }))
    .filter((section) => section.items.length > 0);
  const flat = groups.flatMap((g) => g.items);

  /* Se a navegacao mudar enquanto a palette esta aberta (ex.: "Ver planos" no
     modal de upgrade), a palette fecha-se tambem */
  const openKey = useRef(location.key);
  useEffect(() => {
    if (location.key !== openKey.current) onClose?.();
  }, [location.key, onClose]);

  /* Foco automatico no campo ao abrir */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Mantem a opcao ativa visivel ao andar com as setas */
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active, query]);

  function choose(item) {
    if (isLocked(item, canAccess)) {
      setUpgradeModal({ plan: item.requiredPlan, feature: item.feature });
      return;
    }
    navigate(item.to);
    onClose?.();
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setActive(0);
  }

  function handleKeyDown(e) {
    /* Com o modal de upgrade aberto, e ele que trata do Esc (ouvinte no documento) */
    if (upgradeModal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (e.key === 'Tab') {
      /* O unico elemento focavel e o campo: mantem o foco la dentro */
      e.preventDefault();
    }
  }

  function closeUpgrade() {
    setUpgradeModal(null);
    inputRef.current?.focus();
  }

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] bg-ocean-900/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-command-palette
        aria-label="Pesquisar ecrãs"
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg bg-white rounded-lg border border-n-200 shadow-xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 border-b border-n-200">
          <Search size={18} strokeWidth={1.75} className="text-n-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Pesquisar…"
            aria-label="Pesquisar ecrãs"
            aria-controls="command-palette-list"
            aria-activedescendant={flat[active] ? `command-palette-opt-${active}` : undefined}
            autoComplete="off"
            className="flex-1 h-12 bg-transparent text-sm font-body text-n-900 placeholder:text-n-400 outline-none"
          />
          <kbd className="hidden sm:block text-[10px] font-mono text-n-400 border border-n-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Ecrãs"
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {flat.length === 0 && (
            <p className="px-4 py-6 text-center text-sm font-body text-n-500">Sem resultados</p>
          )}
          {groups.map((section) => (
            <div key={section.id} role="group" aria-label={section.label}>
              <p className="px-4 pt-2 pb-1 text-[11px] font-display font-semibold tracking-wide text-n-400" aria-hidden="true">
                {section.label}
              </p>
              {section.items.map((item) => {
                index += 1;
                const i = index;
                const Icon = item.icon;
                const locked = isLocked(item, canAccess);
                const badge = locked ? PLAN_BADGE[item.requiredPlan] : null;
                const selected = i === active;
                return (
                  <div
                    key={item.to}
                    id={`command-palette-opt-${i}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(item)}
                    className={`mx-2 flex items-center gap-3 px-3 py-2 rounded-md text-sm font-body cursor-pointer ${
                      selected ? 'bg-ocean-50' : ''
                    } ${locked ? 'text-n-400' : selected ? 'text-ocean-700' : 'text-n-700'}`}
                  >
                    <Icon size={17} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                    {locked && <Lock size={12} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {upgradeModal && (
        <UpgradeModal
          plan={upgradeModal.plan}
          feature={upgradeModal.feature}
          onClose={closeUpgrade}
        />
      )}
    </div>
  );
}

export default function CommandPalette({ open, onClose }) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} />;
}
