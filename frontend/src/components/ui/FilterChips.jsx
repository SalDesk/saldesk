// Chips de filtro de selecao unica (uso exclusivo da app do operador)
export default function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={[
              'inline-flex items-center h-7 px-3 rounded-full border text-xs font-body font-medium transition-colors app:h-9 app:px-3.5 app:text-[13px] app:font-semibold',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 app:focus-visible:ring-sand-500',
              active
                ? 'bg-ocean-700 border-ocean-700 text-white app:bg-ocean-900 app:border-ocean-900'
                : 'bg-white border-n-300 text-n-700 hover:bg-n-50 app:border-mare-field app:text-ocean-700 app:hover:bg-ocean-50',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
