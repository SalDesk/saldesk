// Separadores horizontais com contador opcional (uso exclusivo da app do operador)
export default function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-n-200 overflow-x-auto overflow-y-hidden">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-[13px] font-body font-medium whitespace-nowrap border-b-2 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 rounded-t-sm',
              active
                ? 'border-ocean-700 text-ocean-700'
                : 'border-transparent text-n-500 hover:text-n-800',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold',
                  active ? 'bg-ocean-50 text-ocean-700' : 'bg-n-100 text-n-600',
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
