export default function Card({ children, header, padding = 'p-6', className = '' }) {
  return (
    <div
      className={[
        'bg-white rounded-md border border-n-200',
        'shadow-sm',
        className,
      ].join(' ')}
    >
      {header && (
        <div className="px-6 py-4 border-b border-n-200">
          {header}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
  );
}
