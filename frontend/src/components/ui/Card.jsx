const PADDING_PADRAO = 'p-6';

export default function Card({ children, header, padding = PADDING_PADRAO, className = '' }) {
  /* Na app o padding por omissao passa a 22 px; um padding passado pelo chamador ganha sempre */
  const paddingApp = padding === PADDING_PADRAO ? ' app:p-[22px]' : '';
  return (
    <div
      className={[
        'bg-white dark:bg-n-800 rounded-md border border-n-200 dark:border-n-700',
        'shadow-sm',
        'app:rounded-[18px] app:shadow-none app:border-mare-card',
        className,
      ].join(' ')}
    >
      {header && (
        <div className="px-6 py-4 border-b border-n-200 dark:border-n-700 app:px-[22px] app:border-n-100 app:font-display app:text-lg app:font-semibold">
          {header}
        </div>
      )}
      <div className={`${padding}${paddingApp}`}>{children}</div>
    </div>
  );
}
