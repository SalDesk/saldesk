import { useT } from '../../i18n';

export default function MetricCard({ label, value, variacao, variacaoLabel, icon, formato = 'numero' }) {
  const t = useT();
  let valorFormatado;
  if (formato === 'euro') valorFormatado = `${Number(value).toFixed(2)} €`;
  else if (formato === 'percentagem') valorFormatado = `${value}%`;
  else valorFormatado = String(value);

  const positivo = variacao >= 0;
  const semVariacao = variacao === undefined || variacao === null;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-2">{valorFormatado}</p>
      {!semVariacao && (
        <div className={`flex items-center gap-1 text-sm font-medium ${positivo ? 'text-green-600' : 'text-red-500'}`}>
          <span className="text-xs">{positivo ? '▲' : '▼'}</span>
          <span>{variacaoLabel}</span>
          <span className="text-gray-400 font-normal text-xs ml-1">{t('financial.vsPreviousPeriod')}</span>
        </div>
      )}
    </div>
  );
}
