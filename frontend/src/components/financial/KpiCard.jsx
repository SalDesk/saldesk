import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
const EUR_CVE = 110;
function fmtMoney(value, currency) {
  const n = Number(value || 0);
  if (currency === 'CVE') return `${Math.round(n * EUR_CVE).toLocaleString('pt-PT')} CVE`;
  return `€${Math.round(n).toLocaleString('pt-PT')}`;
}
/* Numero finito ou null (null, undefined, texto como '—' e NaN contam como em falta) */
function toFinite(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function fmtDelta(delta, format, currency) {
  if (delta == null) return '';
  const prefix = delta > 0 ? '+' : '';
  if (format === 'euro') {
    /* Em euro o sinal vai antes do simbolo: +€10 / -€10 */
    if (currency !== 'CVE') {
      const n = Math.round(Number(delta || 0));
      const sinal = n > 0 ? '+' : n < 0 ? '-' : '';
      return `${sinal}${fmtMoney(Math.abs(n), currency)}`;
    }
    return `${prefix}${fmtMoney(delta, currency)}`;
  }
  if (format === 'percent') return `${prefix}${Number(delta).toFixed(1)} p.p.`;
  return `${prefix}${Number(delta).toFixed(0)}`;
}
export default function KpiCard({
  label, value, delta, deltaLabel,
  icon: Icon, format = 'number', currency = 'EUR',
  sub,
}) {
  /* Valor em falta (null, undefined, '—', NaN) mostra o traco em euro e percentagem */
  const finite = toFinite(value);
  const formatted =
    format === 'euro'    ? (finite == null ? '—' : fmtMoney(finite, currency)) :
    format === 'percent' ? (finite == null ? '—' : `${finite.toFixed(1)}%`) :
                           String(value ?? 0);
  const isPositive = delta > 0;
  const isNeutral  = delta === 0 || delta == null;
  const DeltaIcon  = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const deltaColor = isNeutral ? 'text-n-400' : isPositive ? 'text-[var(--success)]' : 'text-error';
  return (
    <div className="bg-white rounded-lg border border-n-200 shadow-sm px-5 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 app:rounded-sm app:hover:translate-y-0 app:hover:shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 leading-tight app:normal-case app:tracking-normal app:text-[13px] app:font-medium">{label}</p>
        {Icon && (
          <div className="w-9 h-9 rounded-md bg-ocean-50 flex items-center justify-center shrink-0">
            <Icon size={16} strokeWidth={1.75} className="text-ocean-700" />
          </div>
        )}
      </div>
      <p className="font-display font-bold text-2xl tracking-tight text-n-900 mb-1 leading-tight app:tabular-nums">{formatted}</p>
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
