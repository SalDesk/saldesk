import { AlertTriangle } from 'lucide-react';

export function expiryState(dateStr) {
  if (!dateStr) return null;
  const days = Math.round((new Date(dateStr) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return null;
}

export default function ExpiryBadge({ date }) {
  const state = expiryState(date);
  if (!state) return date ? <span className="text-xs font-body text-n-500">{date}</span> : null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-body font-semibold ${state === 'expired' ? 'text-error' : 'text-amber-600'}`}>
      <AlertTriangle size={12} strokeWidth={1.75} />
      {date} {state === 'expired' ? '(expirado)' : '(expira em breve)'}
    </span>
  );
}
