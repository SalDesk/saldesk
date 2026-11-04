export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-y-3 mb-6 pb-5 border-b border-n-200 app:mb-4 app:pb-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight text-n-900 app:text-xl">{title}</h1>
        {subtitle && (
          <p className="text-sm font-body text-n-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 ml-4 shrink-0 max-w-[calc(100%-1rem)]">{actions}</div>
      )}
    </div>
  );
}
