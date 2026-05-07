import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, hint, required, className = '', ...props },
  ref
) {
  const baseClass = [
    'w-full h-9 px-3 rounded-sm border text-sm font-body bg-n-100 text-n-900',
    'placeholder:text-n-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white',
    error ? 'border-error' : 'border-n-300',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <input ref={ref} className={baseClass} {...props} />
      {error && <p className="text-xs text-error">{error}</p>}
      {hint && !error && <p className="text-xs text-n-500">{hint}</p>}
    </div>
  );
});

export default Input;

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className = '', rows = 3, ...props },
  ref
) {
  const baseClass = [
    'w-full px-3 py-2 rounded-sm border text-sm font-body bg-n-100 text-n-900 resize-none',
    'placeholder:text-n-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white',
    error ? 'border-error' : 'border-n-300',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <textarea ref={ref} rows={rows} className={baseClass} {...props} />
      {error && <p className="text-xs text-error">{error}</p>}
      {hint && !error && <p className="text-xs text-n-500">{hint}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, required, className = '', children, ...props },
  ref
) {
  const baseClass = [
    'w-full h-9 px-3 rounded-sm border text-sm font-body bg-n-100 text-n-900',
    'focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white',
    error ? 'border-error' : 'border-n-300',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <select ref={ref} className={baseClass} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-error">{error}</p>}
      {hint && !error && <p className="text-xs text-n-500">{hint}</p>}
    </div>
  );
});
