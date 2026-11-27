import { useT } from '../../i18n';

/* Top de clientes: lista com barra proporcional ao maior gasto, no estilo Mare */
export default function TopCustomersList({ data }) {
  const t = useT();
  if (!data?.length) {
    return <p className="text-sm font-body text-n-500 py-6 text-center">{t('financial.noData')}</p>;
  }

  const max = Math.max(...data.map((c) => c.total_gasto), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((c, i) => (
        <div key={c.customer_email} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-ocean-50 flex items-center justify-center shrink-0">
            <span className="text-xs font-display font-bold text-ocean-700">{i + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[13px] font-body font-semibold text-n-800 truncate min-w-0">{c.customer_name}</p>
              <p className="text-[13px] font-mono tabular-nums font-semibold text-ocean-900 shrink-0">
                €{Number(c.total_gasto).toFixed(0)}
              </p>
            </div>
            <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-ocean-500 rounded-full"
                style={{ width: `${(c.total_gasto / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
