export default function UnitTable({ data }) {
  if (!data?.length) {
    return <p className="text-sm font-body text-n-400 py-6 text-center">Sem unidades activas</p>;
  }

  const maxReceita = Math.max(...data.map((u) => u.receita), 1);

  return (
    <div className="space-y-3">
      {data.map((unit) => (
        <div key={unit.id} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="min-w-0">
              <span className="font-body font-semibold text-n-800 truncate block">{unit.name}</span>
              <span className="text-xs font-body text-n-400">{unit.unit_type} · {unit.num_reservas} reserva(s)</span>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="font-display font-bold text-ocean-700">€{Number(unit.receita).toFixed(0)}</p>
              <p className="text-xs font-body text-n-500">{unit.taxa_ocupacao}% ocup.</p>
            </div>
          </div>
          {/* Barra de ocupacao */}
          <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-ocean-700 rounded-full transition-all"
              style={{ width: `${unit.taxa_ocupacao}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
