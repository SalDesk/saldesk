export default function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-y-3 mb-6 pb-5 border-b border-n-200 app:mb-6 app:pb-0 app:border-b-0">
      <div>
        {eyebrow && (
          <p data-eyebrow className="hidden app:block mb-1 text-xs font-body font-semibold uppercase tracking-[0.08em] text-ocean-600">{eyebrow}</p>
        )}
        <h1 className="font-display font-bold text-2xl tracking-tight text-n-900 app:text-[26px] app:md:text-[32px] app:leading-tight app:text-ocean-900">{title}</h1>
        {subtitle && (
          <p className="text-sm font-body text-n-500 mt-1 app:text-sm app:md:text-[15px] app:text-n-600">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 ml-4 shrink-0 max-w-[calc(100%-1rem)] app:flex-wrap app:ml-0 app:max-w-full app:shrink">{actions}</div>
      )}
    </div>
  );
}
