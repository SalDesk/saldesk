import { User } from 'lucide-react';

export default function TopCustomersList({ data }) {
  if (!data?.length) {
    return <p className="text-sm font-body text-n-400 py-6 text-center">Sem dados</p>;
  }

  const max = Math.max(...data.map((c) => c.total_gasto), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((c, i) => (
        <div key={c.customer_email} className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
            <span className="text-xs font-display font-bold text-ocean-700">{i + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-body font-semibold text-n-800 truncate">{c.customer_name}</p>
              <p className="text-xs font-display font-bold text-ocean-700 shrink-0 ml-2">
                €{Number(c.total_gasto).toFixed(0)}
              </p>
            </div>
            <div className="h-1 bg-n-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sand-500 rounded-full"
                style={{ width: `${(c.total_gasto / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
