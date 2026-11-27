import { TrendingUp, CalendarDays, BarChart2, AlertTriangle } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import MareStat from '../../components/shared/MareStat';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { CARTAO, TITULO, NUM, fmtMoney, fmtMoneyOuTraco } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function PrevisaoTab({ forecast, currency, loading }) {
  useLingua();
  const t = useT();
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  if (!forecast) return (
    <div className={CARTAO}>
      <EmptyState
        icon={TrendingUp}
        title={t('financial.forecast.unavailable')}
        description={<>{t('financial.forecast.implementBefore')}<span className="font-mono">GET /financial/forecast</span>{t('financial.forecast.implementAfter')}</>}
      />
    </div>
  );
  const { confirmed_future_revenue, same_period_last_year, historical_avg, weeks } = forecast;
  const isBelow = historical_avg > 0 && confirmed_future_revenue < historical_avg * 0.8;
  return (
    <div className="space-y-4">
      {isBelow && <div className="flex items-center gap-3 px-4 py-3 bg-[var(--warning-light)] border border-mare-card rounded-[14px]"><AlertTriangle size={16} strokeWidth={1.75} className="text-n-800 shrink-0" /><p className="text-sm font-body text-n-800">{t('financial.forecast.belowAverage')}</p></div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MareStat icon={CalendarDays} label={t('financial.forecast.confirmedRevenue')} value={fmtMoneyOuTraco(confirmed_future_revenue, currency)} />
        <MareStat icon={TrendingUp} label={t('financial.forecast.samePeriodLastYear')} value={fmtMoneyOuTraco(same_period_last_year, currency)} />
        <MareStat icon={BarChart2} label={t('financial.forecast.historicalAverage')} value={fmtMoneyOuTraco(historical_avg, currency)} />
      </div>
      {weeks?.length > 0 && (
        <div className={CARTAO}>
          <div className="mb-3"><h3 className={TITULO}>{t('financial.forecast.weekly')}</h3></div>
          <div className="space-y-0">{weeks.map((w, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 border-b border-n-100 last:border-0">
              <span className={`text-xs ${NUM} text-n-600 break-words min-w-0`}>{w.week_label || w.week}</span>
              <div className="flex items-center gap-6">
                <span className="text-xs font-body text-n-600">{t('financial.bookingsCount', { n: w.num_reservas })}</span>
                <span className={`${NUM} font-semibold text-ocean-900 text-sm`}>{fmtMoney(w.receita, currency)}</span>
              </div>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}

export default PrevisaoTab;
