import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import usePlan from '../../hooks/usePlan';
import { useT } from '../../i18n';

/* Faixa de uma linha com o estado da avaliacao (mesma logica do TrialBanner) */
export default function TrialStrip() {
  const t = useT();
  const navigate = useNavigate();
  const { isInTrial, isTrialExpired, trialDaysLeft } = usePlan();

  if (isTrialExpired()) {
    return (
      <div
        data-testid="trial-strip"
        className="mb-4 flex items-center gap-3 px-3 py-2 rounded-sm border bg-red-50 border-red-200"
      >
        <AlertTriangle size={15} strokeWidth={1.75} className="text-red-600 shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-0 truncate text-[13px] font-body text-red-700">
          <span className="font-semibold">{t('dashboard.trial.expiredTitle')}</span>
          <span className="hidden md:inline"> {t('dashboard.trial.expiredBody')}</span>
        </p>
        <button
          type="button"
          onClick={() => navigate('/definicoes?tab=facturacao')}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm bg-red-600 text-white text-xs font-body font-semibold hover:bg-red-700 transition-colors shrink-0"
        >
          {t('dashboard.trial.viewPlans')}
          <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (!isInTrial()) return null;

  const days = trialDaysLeft();
  const urgent = days <= 7;

  return (
    <div
      data-testid="trial-strip"
      className={`mb-4 flex items-center gap-3 px-3 py-2 rounded-sm border ${
        urgent ? 'bg-amber-50 border-amber-200' : 'bg-ocean-50 border-ocean-100'
      }`}
    >
      <Clock
        size={15}
        strokeWidth={1.75}
        aria-hidden="true"
        className={`shrink-0 ${urgent ? 'text-amber-700' : 'text-ocean-600'}`}
      />
      <p className={`flex-1 min-w-0 truncate text-[13px] font-body ${urgent ? 'text-amber-800' : 'text-ocean-700'}`}>
        <span className="font-semibold tabular-nums">
          {days === 0 ? t('dashboard.trial.lastDay') : t('dashboard.trial.daysLeft', { days })}
        </span>
        <span className="hidden md:inline"> {t('dashboard.trial.upgradeBody')}</span>
      </p>
      <button
        type="button"
        onClick={() => navigate('/definicoes')}
        className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-sm text-xs font-body font-semibold transition-colors shrink-0 ${
          urgent
            ? 'bg-amber-700 text-white hover:bg-amber-800'
            : 'bg-sand-500 text-n-900 hover:bg-sand-400'
        }`}
      >
        {t('dashboard.trial.viewPlans')}
        <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
