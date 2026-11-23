import { TrendingUp, CalendarDays, BarChart2, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import KpiCard from '../../components/financial/KpiCard';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { fmtMoney } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

function PrevisaoTab({ forecast, currency, loading }) {
  useLingua();
  const t = useT();
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  if (!forecast) return (
    <Card padding="p-0">
      <EmptyState
        icon={TrendingUp}
        title={t('financial.forecast.unavailable')}
        description={<>{t('financial.forecast.implementBefore')}<span className="font-mono">GET /financial/forecast</span>{t('financial.forecast.implementAfter')}</>}
      />
    </Card>
  );
  const { confirmed_future_revenue, same_period_last_year, historical_avg, weeks } = forecast;
  const isBelow = historical_avg > 0 && confirmed_future_revenue < historical_avg * 0.8;
  return (
    <div className="space-y-4">
      {isBelow && <div className="flex items-center gap-3 px-4 py-3 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm"><AlertTriangle size={16} strokeWidth={1.75} className="text-[var(--warning)] shrink-0" /><p className="text-sm font-body text-[var(--warning)]">{t('financial.forecast.belowAverage')}</p></div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard label={t('financial.forecast.confirmedRevenue')} value={confirmed_future_revenue} format="euro" currency={currency} icon={CalendarDays} />
        <KpiCard label={t('financial.forecast.samePeriodLastYear')} value={same_period_last_year} format="euro" currency={currency} icon={TrendingUp} />
        <KpiCard label={t('financial.forecast.historicalAverage')} value={historical_avg} format="euro" currency={currency} icon={BarChart2} />
      </div>
      {weeks?.length > 0 && (
        <Card header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.forecast.weekly')}</h3>}>
          <div className="space-y-0">{weeks.map((w, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-n-100 last:border-0">
              <span className="text-xs font-mono text-n-500">{w.week_label || w.week}</span>
              <div className="flex items-center gap-6">
                <span className="text-xs font-body text-n-500">{t('financial.bookingsCount', { n: w.num_reservas })}</span>
                <span className="font-display font-bold text-ocean-700 text-sm">{fmtMoney(w.receita, currency)}</span>
              </div>
            </div>
          ))}</div>
        </Card>
      )}
    </div>
  );
}

export default PrevisaoTab;
