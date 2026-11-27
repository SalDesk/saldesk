import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Calendar, FileText, Award, Users, AlertTriangle } from 'lucide-react';
import { getHrOverview, updateLeaveStatus } from '../services/staffService';
import { useToast } from '../store/toastStore';
import PageHeader from '../components/layout/PageHeader';
import MareStat from '../components/shared/MareStat';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ExpiryBadge from '../components/shared/ExpiryBadge';
import { useT } from '../i18n';
import { useLingua } from '../utils/formatoLingua';
import { rotuloCargo, rotuloTipoFerias } from './staff/shared';

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
}

/* Estilo Mare: cartao de pagina, titulo de cartao, caixa interior calma e figuras em mono */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const CAIXA = 'bg-mare-head rounded-[14px] px-4 py-3';
const NUM = 'font-mono tabular-nums';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';

export default function RH() {
  const t = useT();
  const lang = useLingua();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getHrOverview());
    } catch {
      toast.error(t('hr.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(staffId, leaveId, status) {
    try {
      await updateLeaveStatus(staffId, leaveId, status);
      toast.success(status === 'approved' ? t('hr.requestApproved') : t('hr.requestRejected'));
      load();
    } catch {
      toast.error(t('hr.errorUpdate'));
    }
  }

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>;

  const pending = data?.pending_leave || [];
  const expiring = data?.expiring || [];
  const staff = data?.staff || [];

  return (
    <div>
      <PageHeader eyebrow={t('nav.sections.gestao')} title={t('hr.title')} subtitle={t('hr.subtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MareStat icon={Calendar} value={pending.length} label={t('hr.pendingLeave')} tone={pending.length ? 'aviso' : 'default'} />
        <MareStat icon={AlertTriangle} value={expiring.length} label={t('hr.expiring')} tone={expiring.length ? 'aviso' : 'default'} />
        <MareStat icon={Users} value={staff.length} label={t('hr.activeStaff')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={CARTAO}>
          <h3 className={`${TITULO} mb-4`}>{t('hr.pendingLeave')}</h3>
          {!pending.length && <p className="text-sm font-body text-n-600">{t('hr.noPending')}</p>}
          <div className="space-y-2">
            {pending.map(l => (
              <div key={l.id} className={CAIXA}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body font-semibold text-sm text-n-900 truncate">{l.staff_name}</p>
                    <p className="text-xs font-body text-n-600">
                      {rotuloTipoFerias(l.type, t)} · <span className={NUM}>{l.start_date} → {l.end_date}</span>
                      <span className={`text-n-600 ${NUM}`}> ({t('hr.daysCount', { n: daysBetween(l.start_date, l.end_date) })})</span>
                    </p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <IconBtn icon={Check} label={t('hr.approve')} hover={EDIT_HOVER} className="text-ocean-700" onClick={() => changeStatus(l.staff_id, l.id, 'approved')} />
                    <IconBtn icon={X} label={t('hr.reject')} hover={DELETE_HOVER} className="text-[var(--error)]" onClick={() => changeStatus(l.staff_id, l.id, 'rejected')} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={CARTAO}>
          <h3 className={`${TITULO} mb-4`}>{t('hr.expiringSoon')}</h3>
          {!expiring.length && <p className="text-sm font-body text-n-600">{t('hr.nothingExpiring')}</p>}
          <div className="space-y-2">
            {expiring.map(item => (
              <div key={`${item.kind}-${item.id}`} className={CAIXA}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.kind === 'document' ? <FileText size={16} strokeWidth={1.75} className="text-ocean-700 shrink-0" /> : <Award size={16} strokeWidth={1.75} className="text-[var(--sand-600)] shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-body font-semibold text-sm text-n-900 truncate">{item.name}</p>
                      <p className="text-xs font-body text-n-600 truncate">{item.staff_name}</p>
                    </div>
                  </div>
                  <ExpiryBadge date={item.expiry_date} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={`${CARTAO} mt-6`}>
        <h3 className={`${TITULO} mb-4`}>{t('hr.staffHeading')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {staff.map(s => (
            <button key={s.id} onClick={() => navigate(`/colaboradores/${s.id}`)}
              className={`flex items-center gap-3 min-h-11 bg-mare-head rounded-[14px] px-4 py-3 text-left hover:bg-ocean-50 transition-colors ${FOCO}`}>
              <div className="w-8 h-8 rounded-full bg-ocean-100 text-ocean-800 flex items-center justify-center font-display font-bold text-xs shrink-0">
                {s.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-body font-semibold text-sm text-n-900 truncate">{s.name}</p>
                <p className="text-xs font-body text-n-600 truncate">{rotuloCargo(s.role, t, lang)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
