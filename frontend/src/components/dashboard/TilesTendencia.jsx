import Sparkline from './Sparkline';

/* Numeros do dia com variacao face a semana passada e tendencia dos ultimos dias.
   tiles: [{ id, label, value, delta, deltaTom: 'bom'|'aviso'|null, deltaTitulo, nota, serie, serieRotulo }]
   delta e serie podem ser null (sem base de comparacao, sem tendencia). */
const TONS_DELTA = {
  bom: 'bg-[var(--success-light)] text-[var(--success)]',
  aviso: 'bg-[var(--warning-light)] text-[var(--warning)]',
};

export default function TilesTendencia({ tiles }) {
  const lista = Array.isArray(tiles) ? tiles : [];
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
      {lista.map((tile) => (
        <article key={tile.id} data-tile={tile.id} className="bg-white border border-n-200 rounded-2xl p-3.5 lg:p-[18px] lg:pb-3.5 flex flex-col gap-1.5 lg:gap-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs lg:text-[13px] font-body font-semibold text-n-600">{tile.label}</span>
            {tile.delta && (
              <span
                title={tile.deltaTitulo || undefined}
                className={`shrink-0 font-mono text-[11px] lg:text-xs font-medium px-2 py-0.5 rounded-full ${TONS_DELTA[tile.deltaTom] || 'bg-n-100 text-n-600'}`}
              >
                {tile.delta}
              </span>
            )}
          </div>
          <div className="flex items-end justify-between gap-3">
            <span className="font-display font-bold text-2xl lg:text-3xl text-ocean-900 tabular-nums leading-tight">{tile.value}</span>
            {tile.serie && (
              <span className="hidden sm:block">
                <Sparkline valores={tile.serie} rotulo={tile.serieRotulo} />
              </span>
            )}
          </div>
          {tile.nota && <span className="text-xs font-body text-n-500">{tile.nota}</span>}
        </article>
      ))}
    </section>
  );
}
