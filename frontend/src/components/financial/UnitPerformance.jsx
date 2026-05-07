function OcupacaoBar({ valor }) {
  const cor = valor >= 70 ? 'bg-green-500' : valor >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${valor}%` }} />
      </div>
      <span className={`text-xs font-medium w-8 text-right ${valor >= 70 ? 'text-green-600' : valor >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
        {valor}%
      </span>
    </div>
  );
}

export default function UnitPerformance({ dados }) {
  if (!dados || dados.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Sem unidades activas no período</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="pb-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Unidade</th>
            <th className="pb-3 text-gray-400 font-medium text-xs uppercase tracking-wide text-right">Res.</th>
            <th className="pb-3 text-gray-400 font-medium text-xs uppercase tracking-wide pl-4">Ocupação</th>
            <th className="pb-3 text-gray-400 font-medium text-xs uppercase tracking-wide text-right">Receita</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {dados.map((u) => (
            <tr key={u.id}>
              <td className="py-3 pr-4">
                <p className="font-medium text-gray-900 leading-tight">{u.name}</p>
                <p className="text-xs text-gray-400">{u.unit_type}</p>
              </td>
              <td className="py-3 text-right text-gray-600 font-medium">{u.num_reservas}</td>
              <td className="py-3 pl-4 w-32">
                <OcupacaoBar valor={u.taxa_ocupacao} />
              </td>
              <td className="py-3 text-right font-bold text-primary-500">
                {Number(u.receita).toFixed(2)} €
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
