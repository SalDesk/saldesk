/* Quadro de um numero no estilo Mare: etiqueta, valor grande e pista opcional.
   O tom (default, aviso, bom) tinge so a pequena caixa do icone (ou um ponto), nunca o valor. */
const TONS = {
  default: 'bg-ocean-50 text-ocean-700',
  aviso:   'bg-sand-100 text-n-800',
  bom:     'bg-turquoise-100 text-turquoise-700',
};

/* Ponto sem icone: cor saturada, visivel sobre o cartao branco */
const PONTOS = {
  default: 'bg-ocean-500',
  aviso:   'bg-sand-500',
  bom:     'bg-turquoise-600',
};

export default function MareStat({ label, value, hint, tone = 'default', icon: Icon }) {
  const tom = Icon ? (TONS[tone] || TONS.default) : (PONTOS[tone] || PONTOS.default);
  const comCaixa = !!Icon || tone !== 'default';

  return (
    <article className="bg-white rounded-[18px] border border-mare-card p-[22px] flex flex-col gap-1.5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-body font-semibold text-n-600">{label}</p>
        {comCaixa && (
          <span
            data-mare-stat-tint
            aria-hidden="true"
            className={`shrink-0 inline-flex items-center justify-center ${Icon ? 'w-8 h-8 rounded-[10px]' : 'w-2.5 h-2.5 rounded-full mt-1'} ${tom}`}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} />}
          </span>
        )}
      </div>
      <p className="font-display text-[28px] md:text-[30px] leading-tight font-bold text-ocean-900 tabular-nums">{value}</p>
      {hint && <p className="text-xs font-body text-n-500">{hint}</p>}
    </article>
  );
}
