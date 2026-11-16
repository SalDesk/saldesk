import { forwardRef, useId } from 'react';

/* Ligacoes de acessibilidade partilhadas por Input, Textarea e Select: id do campo (o recebido ou um gerado)
   para a etiqueta apontar para ele, e aria-describedby para o erro ou a dica (mais o que ja viesse de fora). */
function useCampo({ id, error, hint, descricaoExterna }) {
  const gerado = useId();
  const campoId = id || gerado;
  const erroId = error ? `${campoId}-erro` : undefined;
  const dicaId = hint && !error ? `${campoId}-dica` : undefined;
  const descricao = [descricaoExterna, erroId, dicaId].filter(Boolean).join(' ') || undefined;
  return { campoId, erroId, dicaId, descricao };
}

const Input = forwardRef(function Input(
  { label, error, hint, required, className = '', id, 'aria-describedby': descricaoExterna, ...props },
  ref
) {
  const { campoId, erroId, dicaId, descricao } = useCampo({ id, error, hint, descricaoExterna });
  const baseClass = [
    'w-full h-9 px-3 rounded-sm border text-sm font-body bg-n-100 text-n-900 dark:bg-n-800 dark:text-n-100',
    'placeholder:text-n-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800',
    'app:bg-white app:text-[13px]',
    error ? 'border-error' : 'border-n-300 dark:border-n-600',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={campoId} className="text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <input ref={ref} id={campoId} required={required} aria-invalid={error ? true : undefined} aria-describedby={descricao} className={baseClass} {...props} />
      {error && <p id={erroId} className="text-xs text-error">{error}</p>}
      {hint && !error && <p id={dicaId} className="text-xs text-n-500 dark:text-n-400">{hint}</p>}
    </div>
  );
});

export default Input;

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className = '', rows = 3, id, 'aria-describedby': descricaoExterna, ...props },
  ref
) {
  const { campoId, erroId, dicaId, descricao } = useCampo({ id, error, hint, descricaoExterna });
  const baseClass = [
    'w-full px-3 py-2 rounded-sm border text-sm font-body bg-n-100 text-n-900 dark:bg-n-800 dark:text-n-100 resize-none',
    'placeholder:text-n-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800',
    'app:bg-white app:text-[13px]',
    error ? 'border-error' : 'border-n-300 dark:border-n-600',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={campoId} className="text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea ref={ref} rows={rows} id={campoId} required={required} aria-invalid={error ? true : undefined} aria-describedby={descricao} className={baseClass} {...props} />
      {error && <p id={erroId} className="text-xs text-error">{error}</p>}
      {hint && !error && <p id={dicaId} className="text-xs text-n-500 dark:text-n-400">{hint}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, required, className = '', children, id, 'aria-describedby': descricaoExterna, ...props },
  ref
) {
  const { campoId, erroId, dicaId, descricao } = useCampo({ id, error, hint, descricaoExterna });
  const baseClass = [
    'w-full h-9 px-3 rounded-sm border text-sm font-body bg-n-100 text-n-900 dark:bg-n-800 dark:text-n-100',
    'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white dark:focus:bg-n-800',
    'app:bg-white app:text-[13px]',
    error ? 'border-error' : 'border-n-300 dark:border-n-600',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={campoId} className="text-xs font-body font-bold uppercase tracking-wide text-n-600 dark:text-n-400 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <select ref={ref} id={campoId} required={required} aria-invalid={error ? true : undefined} aria-describedby={descricao} className={baseClass} {...props}>
        {children}
      </select>
      {error && <p id={erroId} className="text-xs text-error">{error}</p>}
      {hint && !error && <p id={dicaId} className="text-xs text-n-500 dark:text-n-400">{hint}</p>}
    </div>
  );
});
