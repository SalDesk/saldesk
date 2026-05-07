const variants = {
  confirmed:   'bg-[var(--success-light)] text-[var(--success)]',
  pending:     'bg-[var(--warning-light)] text-[var(--warning)]',
  cancelled:   'bg-[var(--error-light)] text-[var(--error)]',
  info:        'bg-[var(--info-light)] text-[var(--info)]',
  checked_in:  'bg-ocean-50 text-ocean-700',
  checked_out: 'bg-n-100 text-n-600',
  no_show:     'bg-n-100 text-n-500',
  direct:      'bg-sand-50 text-sand-600',
  default:     'bg-n-100 text-n-600',
};

export default function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-xs text-xs font-body font-semibold uppercase tracking-wide',
        variants[variant] ?? variants.default,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
