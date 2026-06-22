import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogOut } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import usePlan from '../../hooks/usePlan';
import { UpgradeModal } from '../PlanGuard';
import { TYPE_NAV, PLAN_BADGE } from './Sidebar';

const HIDDEN_IN_DRAWER = ['/', '/reservas', '/mensagens'];

export default function MoreDrawer({ open, onClose }) {
  const { operator, logout } = useAuthStore();
  const navigate = useNavigate();
  const { canAccess } = usePlan();
  const [upgradeModal, setUpgradeModal] = useState(null);

  const opType   = operator?.operator_type || 'hotel';
  const navItems = (TYPE_NAV[opType] || TYPE_NAV.hotel)
    .filter(item => !HIDDEN_IN_DRAWER.includes(item.to));

  function handleItemClick(item) {
    const locked = item.requiredPlan && !canAccess(item.feature || item.requiredPlan);
    if (locked) {
      setUpgradeModal({ plan: item.requiredPlan, feature: item.feature });
      return;
    }
    onClose?.();
    navigate(item.to);
  }

  function handleLogout() {
    onClose?.();
    logout();
    navigate('/login');
  }

  return (
    <>
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-ocean-900/40 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto transition-transform duration-250 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-n-300" />
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          {navItems.map(item => {
            const locked = item.requiredPlan && !canAccess(item.feature || item.requiredPlan);
            const badge  = item.requiredPlan ? PLAN_BADGE[item.requiredPlan] : null;
            const Icon   = item.icon;
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`relative flex flex-col items-center justify-center gap-1.5 rounded-md p-3 text-center transition-colors ${
                  locked ? 'text-n-400' : 'text-n-700 hover:bg-n-50'
                }`}
              >
                {locked && (
                  <Lock size={11} strokeWidth={1.75} className="absolute top-1.5 right-1.5 text-n-400" />
                )}
                <Icon size={24} strokeWidth={1.75} className={locked ? 'text-n-300' : 'text-ocean-700'} />
                <span className="text-[11px] font-body font-medium leading-tight">{item.label}</span>
                {badge && (
                  <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded uppercase tracking-wide ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-4 pt-1 pb-5 border-t border-n-100 mt-1">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-body font-medium text-error"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </div>

      {upgradeModal && (
        <UpgradeModal
          plan={upgradeModal.plan}
          feature={upgradeModal.feature}
          onClose={() => setUpgradeModal(null)}
        />
      )}
    </>
  );
}
