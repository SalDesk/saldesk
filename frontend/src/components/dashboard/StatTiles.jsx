/* Numeros do Dashboard com icone colorido: quadrado do icone + valor + etiqueta */
const TONS = {
  ocean: 'bg-ocean-50 text-ocean-700',
  sand: 'bg-sand-100 text-sand-600',
  success: 'bg-[var(--success-light)] text-[var(--success)]',
  warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
};

export default function StatTiles({ tiles }) {
  const lista = Array.isArray(tiles) ? tiles : [];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {lista.map(({ id, icon: Icone, label, value, tone }) => (
        <div key={id} className="bg-white border border-n-200 rounded-md px-3 py-3 flex items-center gap-3 min-w-0">
          <span className={`w-9 h-9 rounded-md grid place-items-center shrink-0 ${TONS[tone] || TONS.ocean}`} aria-hidden="true">
            {Icone && <Icone size={16} strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <p className="font-display font-bold text-lg text-n-900 tabular-nums leading-tight">{value}</p>
            <p className="text-xs font-body text-n-500 truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
