const variants = {
  confirmed:   'bg-[var(--success-light)] text-[var(--success)]',
  pending:     'bg-[var(--warning-light)] text-[var(--warning)]',
  warning:     'bg-[var(--warning-light)] text-[var(--warning)]',
  cancelled:   'bg-[var(--error-light)] text-[var(--error)]',
  info:        'bg-[var(--info-light)] text-[var(--info)]',
  checked_in:  'bg-ocean-50 text-ocean-700 dark:bg-ocean-900 dark:text-ocean-200',
  checked_out: 'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
  no_show:     'bg-n-100 text-n-500 dark:bg-n-700 dark:text-n-400',
  direct:      'bg-sand-50 text-sand-600 dark:bg-n-700 dark:text-sand-400',
  default:     'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
  received:    'bg-[var(--info-light)] text-[var(--info)]',
  preparing:   'bg-[var(--warning-light)] text-[var(--warning)]',
  ready:       'bg-[var(--success-light)] text-[var(--success)]',
  delivered:   'bg-n-100 text-n-600 dark:bg-n-700 dark:text-n-300',
};

/* Tons da app (so aplicados dentro de [data-ui="app"]): areia, ocean, turquesa, neutro e vermelho */
const TONS = {
  sand:      'app:bg-sand-100 app:text-n-800',
  ocean:     'app:bg-ocean-100 app:text-ocean-800',
  turquoise: 'app:bg-turquoise-100 app:text-turquoise-700',
  neutral:   'app:bg-n-100 app:text-n-700',
  red:       'app:bg-[var(--error-light)] app:text-[var(--error)]',
};

const tonDe = {
  pending: 'sand', warning: 'sand', preparing: 'sand',
  confirmed: 'ocean', info: 'ocean', direct: 'ocean', received: 'ocean',
  checked_in: 'turquoise', ready: 'turquoise', delivered: 'turquoise',
  checked_out: 'neutral', no_show: 'neutral', default: 'neutral',
  cancelled: 'red',
};

export default function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-xs text-xs font-body font-semibold uppercase tracking-wide',
        'app:normal-case app:tracking-normal app:rounded-full app:px-2.5',
        variants[variant] ?? variants.default,
        TONS[tonDe[variant] ?? 'neutral'],
        className,
      ].join(' ')}
    >
      {/* Ponto decorativo: so aparece dentro da app (fora dela fica escondido) */}
      <span aria-hidden="true" className="hidden app:inline-block app:w-[7px] app:h-[7px] app:rounded-full app:bg-current app:mr-1.5" />
      {children}
    </span>
  );
}
