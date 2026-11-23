import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { getObligations, setObligations } from '../../services/expensesService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea, Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { fmtDate } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

/* Planos e precos da subscricao (os valores gravados em saldesk_plan) */
const PLANOS = [
  { value: 'starter',  nome: 'Starter',  preco: 29 },
  { value: 'pro',      nome: 'Pro',      preco: 69 },
  { value: 'business', nome: 'Business', preco: 79 },
];

/* ─────────────────── OBRIGACOES ─────────────────── */

function ObrigacoesTab({ currency }) {
  useLingua();
  const t = useT();
  const [obl, setObl] = useState({});
  const [loading, setLoading] = useState(true);
  const now  = new Date();
  const day  = now.getDate();
  const inpsDue = new Date(now.getFullYear(), now.getMonth(), 15);
  const daysToInps = Math.ceil((inpsDue - now) / (1000 * 60 * 60 * 24));

  useEffect(() => { getObligations().then(setObl).finally(() => setLoading(false)); }, []);

  function saveObl(next) { setObl(next); setObligations(next).catch(() => {}); }

  function Insurance({ ins, idx }) {
    const renewal = ins.renewal_date ? new Date(ins.renewal_date + 'T00:00:00Z') : null;
    const daysToRenew = renewal ? Math.ceil((renewal - now) / (1000 * 60 * 60 * 24)) : null;
    const isCritical = daysToRenew != null && daysToRenew <= 30;
    return (
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${isCritical ? 'bg-[var(--warning-light)] border-[var(--warning)]' : 'bg-n-50 border-n-100'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-body font-semibold text-n-800">{ins.name}</p>
          <p className="text-[10px] font-mono text-n-400">{renewal ? `${t('financial.obligations.renewal', { date: fmtDate(ins.renewal_date) })}${isCritical ? ` (${daysToRenew}d)` : ''}` : t('financial.obligations.noDate')}</p>
        </div>
        <span className="text-xs font-body text-n-600 shrink-0">{ins.amount_annual ? t('financial.obligations.perYear', { v: ins.amount_annual }) : '—'}</span>
        {isCritical && <AlertTriangle size={14} strokeWidth={1.75} className="text-[var(--warning)] shrink-0" />}
        <button aria-label={t('financial.obligations.removeAria', { name: ins.name })} onClick={() => { const list = (obl.insurances || []).filter((_, i) => i !== idx); saveObl({ ...obl, insurances: list }); }} className="p-1 text-n-400 hover:text-[var(--error)] transition-colors"><Trash2 size={12} strokeWidth={1.75} /></button>
      </div>
    );
  }

  const [newIns, setNewIns] = useState({ name: '', renewal_date: '', amount_annual: '' });

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* INPS */}
      <Card padding="px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-sm text-n-700">{t('financial.obligations.inpsTitle')}</h3>
          {daysToInps <= 5 && daysToInps > 0 && <span className="flex items-center gap-1 text-xs font-mono text-[var(--error)] bg-[var(--error-light)] px-2 py-0.5 rounded-xs"><AlertTriangle size={10} strokeWidth={2} />{t('financial.obligations.dueIn', { n: daysToInps })}</span>}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">{t('financial.obligations.filingDate')}</span>
            <span className="font-mono text-n-800">{t('financial.obligations.filingDay')}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">{t('financial.obligations.employerContribution')}</span>
            <span className="font-mono text-n-800">{t('financial.obligations.employerRate')}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-body text-n-600">{t('financial.obligations.employeeContribution')}</span>
            <span className="font-mono text-n-800">{t('financial.obligations.employeeRate')}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-n-100">
          <div className="w-56">
            <Select aria-label={t('financial.obligations.inpsStatusAria')} value={obl.inps_status_current || 'pending'} onChange={e => saveObl({ ...obl, inps_status_current: e.target.value })}>
              <option value="pending">{t('financial.obligations.pendingThisMonth')}</option>
              <option value="paid">{t('financial.obligations.paidThisMonth')}</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* IUR */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">{t('financial.obligations.iurTitle')}</h3>
        <p className="text-xs font-body text-n-500 mb-3">{t('financial.obligations.iurDescription')}</p>
        <Textarea
          aria-label={t('financial.obligations.iurNotesAria')}
          value={obl.iur_notes || ''}
          onChange={e => saveObl({ ...obl, iur_notes: e.target.value })}
          placeholder={t('financial.obligations.iurNotesPlaceholder')}
          rows={3}
        />
      </Card>

      {/* Seguros */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">{t('financial.obligations.insurance')}</h3>
        <div className="space-y-2 mb-3">
          {(obl.insurances || []).map((ins, i) => <Insurance key={i} ins={ins} idx={i} />)}
          {(obl.insurances || []).length === 0 && <p className="text-xs font-body text-n-400">{t('financial.obligations.noInsurance')}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <Input aria-label={t('financial.obligations.insuranceName')} value={newIns.name} onChange={e => setNewIns(p => ({ ...p, name: e.target.value }))} placeholder={t('financial.obligations.insuranceName')} />
          <Input aria-label={t('financial.obligations.insuranceRenewalAria')} type="date" value={newIns.renewal_date} onChange={e => setNewIns(p => ({ ...p, renewal_date: e.target.value }))} />
          <div className="flex gap-1 items-end">
            <div className="flex-1">
              <Input aria-label={t('financial.obligations.insuranceAnnualAria')} type="number" value={newIns.amount_annual} onChange={e => setNewIns(p => ({ ...p, amount_annual: e.target.value }))} placeholder={t('financial.obligations.perYearPlaceholder')} className="font-mono" />
            </div>
            <Button aria-label={t('financial.obligations.addInsurance')} icon={Plus} onClick={() => { if (!newIns.name) return; saveObl({ ...obl, insurances: [...(obl.insurances || []), { ...newIns, amount_annual: Number(newIns.amount_annual) }] }); setNewIns({ name: '', renewal_date: '', amount_annual: '' }); }} />
          </div>
        </div>
      </Card>

      {/* SalDesk */}
      <Card padding="px-5 py-4">
        <h3 className="font-display font-semibold text-sm text-n-700 mb-3">{t('financial.obligations.subscription')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('financial.obligations.currentPlan')} aria-label={t('financial.obligations.currentPlan')} value={obl.saldesk_plan || 'starter'} onChange={e => saveObl({ ...obl, saldesk_plan: e.target.value })}>
            {PLANOS.map(p => <option key={p.value} value={p.value}>{t('financial.obligations.planPrice', { plan: p.nome, price: p.preco })}</option>)}
          </Select>
          <Input label={t('financial.obligations.renewalDate')} aria-label={t('financial.obligations.renewalDate')} type="date" value={obl.saldesk_renewal || ''} onChange={e => saveObl({ ...obl, saldesk_renewal: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}

export default ObrigacoesTab;
