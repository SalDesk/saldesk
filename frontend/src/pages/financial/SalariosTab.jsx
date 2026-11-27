import { useState, useEffect } from 'react';
import {
  Edit2,
  Users,
  Check,
  Save,
} from 'lucide-react';
import { getSalaryConfig, setSalaryConfig as persistSalaryConfig, getSalaryPayments, addSalaryPayment } from '../../services/expensesService';
import { listStaff } from '../../services/staffService';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import MareStat from '../../components/shared/MareStat';
import { IconBtn, EDIT_HOVER } from '../../components/shared/IconBtn';
import { CARTAO, CAIXA, NUM, PS_VARIANT, fmtMoney, fmtDica } from './shared';
import { rotuloCargo } from '../staff/shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

/* ─────────────────── SALARIOS ─────────────────── */

function SalariosTab({ currency }) {
  const lang = useLingua();
  const t = useT();
  const [staffList,    setStaffList]    = useState([]);
  const [salaryConfig, setSalaryConfig] = useState({});
  const [payments,     setPayments]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [editModal,    setEditModal]    = useState(null);
  const [payModal,     setPayModal]     = useState(null);
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listStaff().then(d => (d || []).filter(s => s.status === 'active')).catch(() => []),
      getSalaryConfig(),
      getSalaryPayments(),
    ])
      .then(([staffData, cfg, pay]) => {
        setStaffList(staffData);
        setSalaryConfig(cfg);
        setPayments(pay);
      })
      .finally(() => setLoading(false));
  }, []);

  function getConfig(staffId) {
    return salaryConfig[staffId] || { base: 0, food: 0, transport: 0, inps_pct: 15 };
  }

  function totalCost(cfg) {
    const base = Number(cfg.base || 0);
    return base + Number(cfg.food || 0) + Number(cfg.transport || 0) + base * (Number(cfg.inps_pct || 0) / 100);
  }

  async function handleSaveConfig(staffId, cfg) {
    await persistSalaryConfig(staffId, cfg);
    setSalaryConfig(prev => ({ ...prev, [staffId]: cfg }));
    setEditModal(null);
  }

  async function handlePayment(staffId, amount) {
    const payment = await addSalaryPayment({ staffId, month: curMonth, year: curYear, amount });
    setPayments(prev => [...prev, payment]);
    setPayModal(null);
  }

  const totalFolha = staffList.reduce((s, st) => s + totalCost(getConfig(st.id)), 0);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  const columns = [
    { key: 'colaborador', label: t('financial.columns.staff'), render: s => <div><p className="font-body font-semibold text-n-900">{s.name}</p><p className="text-xs font-body text-n-600">{rotuloCargo(s.role, t, lang)}</p></div> },
    { key: 'base', label: t('financial.payroll.baseSalary'), render: s => { const cfg = getConfig(s.id); return <span className={`${NUM} text-n-700`}>{cfg.base ? fmtMoney(cfg.base, currency) : <span className="text-n-500">—</span>}</span>; } },
    { key: 'subsidios', label: t('financial.payroll.allowances'), render: s => { const cfg = getConfig(s.id); return <span className={`text-xs ${NUM} text-n-600`}>{(cfg.food || cfg.transport) ? `${cfg.food ? t('financial.payroll.meal', { v: fmtMoney(cfg.food, currency) }) : ''} ${cfg.transport ? t('financial.payroll.transport', { v: fmtMoney(cfg.transport, currency) }) : ''}`.trim() : '—'}</span>; } },
    { key: 'inps', label: t('financial.payroll.employerInps'), render: s => <span className={`${NUM} text-n-600`}>{getConfig(s.id).inps_pct || 15}%</span> },
    { key: 'custo', label: t('financial.payroll.totalCostMonth'), render: s => <span className={`${NUM} font-bold text-[var(--error)] whitespace-nowrap`}>{fmtMoney(totalCost(getConfig(s.id)), currency)}</span> },
    {
      key: 'estado', label: t('financial.columns.status'),
      render: s => {
        const paid = payments.some(p => p.staffId === s.id && p.month === curMonth && p.year === curYear);
        return (
          <Badge variant={PS_VARIANT[paid ? 'paid' : 'pending']}>
            {paid ? t('financial.paymentStatus.paid') : t('financial.paymentStatus.pending')}
          </Badge>
        );
      },
    },
    {
      key: 'acoes', label: '',
      render: s => {
        const cfg  = getConfig(s.id);
        const cost = totalCost(cfg);
        const paid = payments.some(p => p.staffId === s.id && p.month === curMonth && p.year === curYear);
        return (
          <div className="flex items-center gap-1">
            <IconBtn icon={Edit2} label={t('financial.payroll.editAria', { name: s.name })} onClick={() => setEditModal({ staff: s, cfg })} hover={EDIT_HOVER} />
            {!paid && <Button size="sm" aria-label={t('financial.payroll.payAria', { name: s.name })} onClick={() => setPayModal({ staff: s, amount: cost })}>{t('financial.payroll.pay')}</Button>}
          </div>
        );
      },
    },
  ];

  const pagosEsteMes = payments.filter(p => p.month === curMonth && p.year === curYear).length;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
        <MareStat label={t('financial.payroll.activeStaff')} value={staffList.length} />
        <MareStat label={t('financial.payroll.totalPayroll')} value={fmtMoney(totalFolha, currency)} />
        <MareStat label={t('financial.payroll.paidThisMonth')} value={pagosEsteMes} tone="bom" />
        <MareStat label={t('financial.payroll.unpaidThisMonth')} value={staffList.length - pagosEsteMes} tone="aviso" />
      </div>

      {staffList.length === 0 ? (
        <div className={CARTAO}><EmptyState icon={Users} title={t('financial.payroll.empty')} /></div>
      ) : (
        <div className={CARTAO}>
          <Table columns={columns} rows={staffList} compact />
        </div>
      )}

      {/* Edit salary modal */}
      {editModal && (
        <Modal open onClose={() => setEditModal(null)} title={t('financial.payroll.salaryTitle', { name: editModal.staff.name })} size="sm">
          <SalaryForm cfg={editModal.cfg} onSave={cfg => handleSaveConfig(editModal.staff.id, cfg)} onClose={() => setEditModal(null)} />
        </Modal>
      )}

      {/* Pay modal */}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={t('financial.payroll.paymentTitle', { name: payModal.staff.name })} size="sm">
          <div className="space-y-4">
            <div className={`${CAIXA} px-3 py-2`}>
              <p className="text-xs font-body text-n-600">{t('financial.payroll.calculated')}</p>
              <p className={`${NUM} font-bold text-lg text-n-800`}>{fmtMoney(payModal.amount, currency)}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setPayModal(null)} className="flex-1">{t('common.cancel')}</Button>
              <Button icon={Check} onClick={() => handlePayment(payModal.staff.id, payModal.amount)} className="flex-1">{t('financial.confirmPayment')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SalaryForm({ cfg, onSave, onClose }) {
  const t = useT();
  useLingua();
  const [form, setForm] = useState({ base: cfg.base || 0, food: cfg.food || 0, transport: cfg.transport || 0, inps_pct: cfg.inps_pct || 15 });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const total = Number(form.base) + Number(form.food) + Number(form.transport) + Number(form.base) * (Number(form.inps_pct) / 100);
  return (
    <div className="space-y-3">
      <Input label={t('financial.payroll.baseMonth')} aria-label={t('financial.payroll.baseMonth')} type="number" min="0" step="1" value={form.base} onChange={set('base')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('financial.payroll.mealAllowance')} aria-label={t('financial.payroll.mealAllowance')} type="number" min="0" step="1" value={form.food} onChange={set('food')} />
        <Input label={t('financial.payroll.transportAllowance')} aria-label={t('financial.payroll.transportAllowance')} type="number" min="0" step="1" value={form.transport} onChange={set('transport')} />
      </div>
      <Input label={t('financial.payroll.employerInpsPct')} aria-label={t('financial.payroll.employerInpsPct')} type="number" min="0" max="100" step="0.5" value={form.inps_pct} onChange={set('inps_pct')} hint={t('financial.payroll.inpsHint')} />
      <div className={`${CAIXA} px-3 py-2 flex justify-between gap-3`}>
        <span className="text-xs font-body text-n-600">{t('financial.payroll.totalMonthly')}</span>
        <span className={`${NUM} font-bold text-sm text-[var(--error)]`}>{fmtDica(total, 'EUR')}</span>
      </div>
      <div className="flex gap-3"><Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button><Button icon={Save} onClick={() => onSave({ base: Number(form.base), food: Number(form.food), transport: Number(form.transport), inps_pct: Number(form.inps_pct) })} className="flex-1">{t('common.save')}</Button></div>
    </div>
  );
}

export default SalariosTab;
