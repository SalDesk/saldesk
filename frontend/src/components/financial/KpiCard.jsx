import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({ label, value, delta, deltaLabel, icon: Icon, format = 'number' }) {
  const formatted =
    format === 'euro'    ? `€${Number(value || 0).toFixed(0)}` :
    format === 'percent' ? `${Number(value || 0).toFixed(1)}%` :
                           String(value ?? 0);

  const isPositive = delta > 0;
  const isNeutral  = delta === 0 || delta == null;
  const DeltaIcon  = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const deltaColor = isNeutral ? 'text-n-400' : isPositive ? 'text-[var(--success)]' : 'text-[var(--error)]';

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
            <Icon size={16} strokeWidth={1.75} className="text-ocean-700" />
          </div>
        )}
      </div>
      <p className="font-display font-bold text-2xl text-n-900 mb-2">{formatted}</p>
      {delta != null && (
        <div className={`flex items-center gap-1 text-xs font-body ${deltaColor}`}>
          <DeltaIcon size={12} strokeWidth={2} />
          <span>
            {format === 'percent'
              ? `${delta > 0 ? '+' : ''}${Number(delta).toFixed(1)} p.p.`
              : `${delta > 0 ? '+' : ''}${Number(delta).toFixed(format === 'euro' ? 0 : 0)}`}
            {deltaLabel && <span className="text-n-400 ml-1">{deltaLabel}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
