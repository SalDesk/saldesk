import { Loader2 } from 'lucide-react';

const variants = {
  primary:   'bg-ocean-700 hover:bg-ocean-500 text-white border border-transparent',
  secondary: 'bg-white hover:bg-n-50 text-n-700 border border-n-300',
  ghost:     'bg-transparent hover:bg-ocean-50 text-ocean-700 border border-transparent',
  danger:    'bg-error hover:bg-red-700 text-white border border-transparent',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  children,
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-body font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-300 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading
        ? <Loader2 size={16} className="animate-spin shrink-0" />
        : Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      }
      {children}
      {IconRight && !loading && <IconRight size={16} strokeWidth={1.75} className="shrink-0" />}
    </button>
  );
}
