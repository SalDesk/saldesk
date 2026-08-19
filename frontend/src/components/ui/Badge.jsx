const variants = {
  confirmed:   'bg-[var(--success-light)] text-[var(--success)]',
  pending:     'bg-[var(--warning-light)] text-[var(--warning)]',
  cancelled:   'bg-[var(--error-light)] text-[var(--error)]',
  info:        'bg-[var(--info-light)] text-[var(--info)]',
  checked_in:  'bg-ocean-50 text-ocean-700 dark:bg-ocean-900 dark:text-ocean-200',
  checked_out: 'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
  no_show:     'bg-n-100 text-n-500 dark:bg-n-700 dark:text-n-400',
  direct:      'bg-sand-50 text-sand-600 dark:bg-n-700 dark:text-sand-400',
  default:     'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
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
