import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
const EUR_CVE = 110;
function fmtMoney(value, currency) {
  const n = Number(value || 0);
  if (currency === 'CVE') return `${Math.round(n * EUR_CVE).toLocaleString('pt-PT')} CVE`;
  return `€${Math.round(n).toLocaleString('pt-PT')}`;
}
function fmtDelta(delta, format, currency) {
  if (delta == null) return '';
  const prefix = delta > 0 ? '+' : '';
  if (format === 'euro') return `${prefix}${fmtMoney(delta, currency)}`;
  if (format === 'percent') return `${prefix}${Number(delta).toFixed(1)} p.p.`;
  return `${prefix}${Number(delta).toFixed(0)}`;
}
export default function KpiCard({
  label, value, delta, deltaLabel,
  icon: Icon, format = 'number', currency = 'EUR',
  sub,
}) {
  const formatted =
    format === 'euro'    ? fmtMoney(value, currency) :
    format === 'percent' ? `${Number(value || 0).toFixed(1)}%` :
                           String(value ?? 0);
  const isPositive = delta > 0;
  const isNeutral  = delta === 0 || delta == null;
  const DeltaIcon  = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const deltaColor = isNeutral ? 'text-n-400' : isPositive ? 'text-[#1A7A4A]' : 'text-error';
  return (
    <div className="bg-white rounded-lg border border-n-200 shadow-sm px-5 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 leading-tight">{label}</p>
        {Icon && (
          <div className="w-9 h-9 rounded-md bg-ocean-50 flex items-center justify-center shrink-0">
            <Icon size={16} strokeWidth={1.75} className="text-ocean-700" />
          </div>
        )}
      </div>
      <p className="font-display font-bold text-2xl tracking-tight text-n-900 mb-1 leading-tight">{formatted}</p>
      {sub && <p className="text-xs font-body text-n-400 mb-1">{sub}</p>}
      {delta != null && (
        <div className={`flex items-center gap-1 text-xs font-body ${deltaColor}`}>
          <DeltaIcon size={12} strokeWidth={2} />
          <span>
            {fmtDelta(delta, format, currency)}
            {deltaLabel && <span className="text-n-400 ml-1">{deltaLabel}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
