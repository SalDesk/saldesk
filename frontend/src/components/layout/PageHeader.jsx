export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-n-900">{title}</h1>
        {subtitle && (
          <p className="text-sm font-body text-n-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 ml-4">{actions}</div>
      )}
    </div>
  );
}
