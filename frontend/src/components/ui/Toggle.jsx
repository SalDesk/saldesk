import { useId } from 'react';

/* Interruptor com nome e estado para leitores de ecra: role="switch", aria-checked, nome pela etiqueta
   (ou por aria-label quando nao ha etiqueta visivel) e a dica como descricao. */
function Toggle({ checked, onChange, label, hint: dica, description, 'aria-label': ariaLabel }) {
  const hint = dica ?? description; /* description: nome antigo usado pelo AdminSystem */
  const id = useId();
  const labelId = `${id}-etiqueta`;
  const hintId = `${id}-dica`;
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-n-100 last:border-0">
      <div>
        {label && <p id={labelId} className="text-sm font-display font-semibold text-n-800">{label}</p>}
        {hint && <p id={hintId} className="text-xs font-body text-n-500 mt-0.5">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={!!checked}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5 ${checked ? 'bg-ocean-700' : 'bg-n-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default Toggle;
