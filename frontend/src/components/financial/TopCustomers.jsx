const MEDALHA = ['🥇', '🥈', '🥉'];

export default function TopCustomers({ dados }) {
  if (!dados || dados.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Sem dados de clientes no período</p>;
  }

  const maxGasto = dados[0]?.total_gasto || 1;

  return (
    <div className="space-y-3">
      {dados.map((c, i) => (
        <div key={c.customer_email} className="flex items-center gap-3">
          <span className="text-lg w-6 text-center shrink-0">
            {MEDALHA[i] || <span className="text-xs font-bold text-gray-400">{i + 1}</span>}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900 truncate">{c.customer_name}</p>
              <p className="text-sm font-bold text-primary-500 shrink-0 ml-2">
                {Number(c.total_gasto).toFixed(2)} €
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-300 rounded-full"
                  style={{ width: `${(c.total_gasto / maxGasto) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{c.num_visitas}x</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
