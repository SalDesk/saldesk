import { useRef } from 'react';

// Separadores horizontais com contador opcional (uso exclusivo da app do operador).
// Teclado: setas esquerda/direita (com volta), Home e End activam e focam o separador vizinho;
// so o activo entra na ordem do Tab (ou o primeiro, se nenhum estiver activo).
export default function Tabs({ tabs, value, onChange }) {
  const refs = useRef([]);
  const haActivo = tabs.some((t) => t.id === value);

  function aoCarregarTecla(e, indice) {
    const ultimo = tabs.length - 1;
    let destino = null;
    if (e.key === 'ArrowRight') destino = indice === ultimo ? 0 : indice + 1;
    else if (e.key === 'ArrowLeft') destino = indice === 0 ? ultimo : indice - 1;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = ultimo;
    if (destino === null) return;
    e.preventDefault();
    onChange(tabs[destino].id);
    refs.current[destino]?.focus();
  }

  /* app: a faixa passa a pilula branca com borda de cartao; a rolagem horizontal fica dentro dela */
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-n-200 overflow-x-auto overflow-y-hidden app:border app:border-mare-card app:bg-white app:rounded-full app:p-1 app:w-fit app:max-w-full">
      {tabs.map((tab, i) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active || (!haActivo && i === 0) ? 0 : -1}
            onKeyDown={(e) => aoCarregarTecla(e, i)}
            onClick={() => onChange(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-[13px] font-body font-medium whitespace-nowrap border-b-2 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 rounded-t-sm',
              /* app: pilula de 40 px com area de toque de 44 px (pseudo-elemento), sem linha inferior */
              'app:relative app:min-h-10 app:px-4 app:py-0 app:mb-0 app:border-b-0 app:rounded-full app:text-sm app:font-semibold app:focus-visible:ring-sand-500',
              "app:before:absolute app:before:content-[''] app:before:inset-x-0 app:before:-inset-y-0.5",
              active
                ? 'border-ocean-700 text-ocean-700 app:bg-ocean-900 app:text-white'
                : 'border-transparent text-n-500 hover:text-n-800 app:text-ocean-700 app:hover:text-ocean-700 app:hover:bg-ocean-50',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold',
                  active ? 'bg-ocean-50 text-ocean-700 app:bg-white/15 app:text-white' : 'bg-n-100 text-n-600',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
