import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Zap } from 'lucide-react';
import usePlan, { FEATURE_PLAN, FEATURE_DESCRIPTIONS, PLAN_LEVEL, PLAN_PRICES } from '../hooks/usePlan';

const PLAN_LABEL = { business: 'Business', pro: 'Pro' };
const PLAN_BADGE_CLASS = {
  business: 'bg-ocean-700',
  pro:      'bg-sand-500',
};

function LockCard({ requiredPlan, feature, onVoltar }) {
  const navigate = useNavigate();
  const label = PLAN_LABEL[requiredPlan] || requiredPlan;
  const desc  = FEATURE_DESCRIPTIONS[feature] || 'Funcionalidade disponivel num plano superior.';
  const price = PLAN_PRICES[requiredPlan] || '—';

  return (
    <div className="bg-white rounded-xl border border-n-200 shadow-2xl p-8 max-w-sm w-full">
      <div className="w-14 h-14 rounded-full bg-ocean-50 flex items-center justify-center mx-auto mb-4">
        <Lock size={24} strokeWidth={1.75} className="text-ocean-700" />
      </div>

      <div className="flex justify-center mb-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wide text-white ${PLAN_BADGE_CLASS[requiredPlan] || 'bg-n-600'}`}>
          <Zap size={10} strokeWidth={2.5} />
          Plano {label}
        </span>
      </div>

      <h2 className="font-display font-bold text-xl text-n-900 text-center mb-2">
        Funcionalidade {label}
      </h2>
      <p className="text-sm font-body text-n-500 text-center leading-relaxed mb-4">
        {desc}
      </p>
      <p className="text-xs font-body text-n-400 text-center mb-6">
        Plano {label} a partir de{' '}
        <span className="font-semibold text-n-600">€{price}/mes</span>
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => navigate('/definicoes')}
          className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-md bg-ocean-700 text-white text-sm font-body font-semibold hover:bg-ocean-500 transition-colors"
        >
          Ver planos de subscricao
          <ArrowRight size={15} strokeWidth={1.75} />
        </button>
        <button
          onClick={onVoltar}
          className="w-full h-10 px-4 rounded-md border border-n-200 text-sm font-body text-n-600 hover:bg-n-50 transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

/* ── UpgradeModal — floating modal for Sidebar click ── */
export function UpgradeModal({ plan: requiredPlan, feature, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <LockCard requiredPlan={requiredPlan} feature={feature} onVoltar={onClose} />
    </div>
  );
}

/* ── PlanGuard — page-level wrapper ── */
export default function PlanGuard({ plan: requiredPlan, feature, children }) {
  const navigate    = useNavigate();
  const { getPlanLevel } = usePlan();

  const effectivePlan = requiredPlan || FEATURE_PLAN[feature];
  if (!effectivePlan) return <>{children}</>;

  const hasAccess = getPlanLevel() >= (PLAN_LEVEL[effectivePlan] || 99);
  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred preview of page content */}
      <div
        className="select-none pointer-events-none blur-sm opacity-30 overflow-hidden max-h-[60vh]"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
        <LockCard
          requiredPlan={effectivePlan}
          feature={feature}
          onVoltar={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
