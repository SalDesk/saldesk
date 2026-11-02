import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, AlertTriangle, Clock,
} from 'lucide-react';
import usePlan from '../../hooks/usePlan';
import { useT } from '../../i18n';

/* ─── Trial banner ───────────────────────────────────────────── */

export default function TrialBanner() {
  const t        = useT();
  const navigate = useNavigate();
  const { isInTrial, isTrialExpired, trialDaysLeft } = usePlan();

  if (isTrialExpired()) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md">
        <AlertTriangle size={16} strokeWidth={1.75} className="text-error shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body font-semibold text-error">{t('dashboard.trial.expiredTitle')}</p>
          <p className="text-xs font-body text-red-600">{t('dashboard.trial.expiredBody')}</p>
        </div>
        <button
          onClick={() => navigate('/definicoes?tab=facturacao')}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-error text-white text-xs font-body font-semibold hover:bg-red-700 transition-colors shrink-0"
        >
          {t('dashboard.trial.viewPlans')}
          <ArrowRight size={13} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  if (!isInTrial()) return null;

  const days    = trialDaysLeft();
  const urgent  = days <= 7;

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-3 px-4 py-3 rounded-md border ${
      urgent ? 'bg-[#FFF7ED] border-[#FDBA74]' : 'bg-ocean-50 border-ocean-200'
    }`}>
      <Clock size={16} strokeWidth={1.75} className={`shrink-0 ${urgent ? 'text-[#B45309]' : 'text-ocean-600'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-body font-semibold ${urgent ? 'text-[#B45309]' : 'text-ocean-700'}`}>
          {days === 0 ? t('dashboard.trial.lastDay') : t('dashboard.trial.daysLeft', { days })}
        </p>
        <p className={`text-xs font-body ${urgent ? 'text-orange-600' : 'text-ocean-600'}`}>
          {t('dashboard.trial.upgradeBody')}
        </p>
      </div>
      <button
        onClick={() => navigate('/definicoes')}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-body font-semibold transition-colors shrink-0 ${
          urgent
            ? 'bg-[#B45309] text-white hover:bg-[#92400E]'
            : 'bg-ocean-700 text-white hover:bg-ocean-500'
        }`}
      >
        {t('dashboard.trial.viewPlans')}
        <ArrowRight size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}
