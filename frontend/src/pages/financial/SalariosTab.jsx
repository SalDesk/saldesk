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
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { fmtMoney } from './shared';

/* ─────────────────── SALARIOS ─────────────────── */

function SalariosTab({ currency }) {
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
    { key: 'colaborador', label: 'Colaborador', render: s => <div><p className="font-body font-semibold text-n-900">{s.name}</p><p className="text-xs font-body text-n-500">{s.role}</p></div> },
    { key: 'base', label: 'Salario base', render: s => { const cfg = getConfig(s.id); return <span className="font-mono text-n-700">{cfg.base ? fmtMoney(cfg.base, currency) : <span className="text-n-300">—</span>}</span>; } },
    { key: 'subsidios', label: 'Subsidios', render: s => { const cfg = getConfig(s.id); return <span className="text-xs font-body text-n-500">{(cfg.food || cfg.transport) ? `${cfg.food ? `Alim. ${fmtMoney(cfg.food, currency)}` : ''} ${cfg.transport ? `Transp. ${fmtMoney(cfg.transport, currency)}` : ''}`.trim() : '—'}</span>; } },
    { key: 'inps', label: 'INPS patronal', render: s => <span className="font-mono text-n-600">{getConfig(s.id).inps_pct || 15}%</span> },
    { key: 'custo', label: 'Custo total/mes', render: s => <span className="font-display font-bold text-[var(--error)]">{fmtMoney(totalCost(getConfig(s.id)), currency)}</span> },
    {
      key: 'estado', label: 'Estado',
      render: s => {
        const paid = payments.some(p => p.staffId === s.id && p.month === curMonth && p.year === curYear);
        return (
          <span className={`text-xs font-mono px-2 py-0.5 rounded-xs ${paid ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--warning-light)] text-[var(--warning)]'}`}>
            {paid ? 'Pago' : 'Pendente'}
          </span>
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
            <button aria-label={`Editar salario - ${s.name}`} onClick={() => setEditModal({ staff: s, cfg })} className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button>
            {!paid && <Button size="sm" aria-label={`Pagar salario - ${s.name}`} onClick={() => setPayModal({ staff: s, amount: cost })}>Pagar</Button>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card padding="px-4 py-3"><p className="font-display font-bold text-xl text-n-900">{staffList.length}</p><p className="text-xs font-body text-n-500">Colaboradores activos</p></Card>
        <Card padding="px-4 py-3"><p className="font-display font-bold text-xl text-[var(--error)]">{fmtMoney(totalFolha, currency)}</p><p className="text-xs font-body text-n-500">Folha salarial total/mes</p></Card>
        <Card padding="px-4 py-3"><p className="font-display font-bold text-xl text-[var(--success)]">{payments.filter(p => p.month === curMonth && p.year === curYear).length}</p><p className="text-xs font-body text-n-500">Pagos este mes</p></Card>
        <Card padding="px-4 py-3"><p className="font-display font-bold text-xl text-[var(--warning)]">{staffList.length - payments.filter(p => p.month === curMonth && p.year === curYear).length}</p><p className="text-xs font-body text-n-500">Por pagar este mes</p></Card>
      </div>

      {staffList.length === 0 ? (
        <Card padding="p-0"><EmptyState icon={Users} title="Sem colaboradores activos." /></Card>
      ) : (
        <Card padding="p-0">
          <Table columns={columns} rows={staffList} compact />
        </Card>
      )}

      {/* Edit salary modal */}
      {editModal && (
        <Modal open onClose={() => setEditModal(null)} title={`Salario — ${editModal.staff.name}`} size="sm">
          <SalaryForm cfg={editModal.cfg} onSave={cfg => handleSaveConfig(editModal.staff.id, cfg)} onClose={() => setEditModal(null)} />
        </Modal>
      )}

      {/* Pay modal */}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={`Registar pagamento — ${payModal.staff.name}`} size="sm">
          <div className="space-y-4">
            <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm">
              <p className="text-xs font-body text-n-500">Valor calculado</p>
              <p className="font-display font-bold text-lg text-n-800">{fmtMoney(payModal.amount, currency)}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setPayModal(null)} className="flex-1">Cancelar</Button>
              <Button icon={Check} onClick={() => handlePayment(payModal.staff.id, payModal.amount)} className="flex-1">Confirmar pagamento</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SalaryForm({ cfg, onSave, onClose }) {
  const [form, setForm] = useState({ base: cfg.base || 0, food: cfg.food || 0, transport: cfg.transport || 0, inps_pct: cfg.inps_pct || 15 });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const total = Number(form.base) + Number(form.food) + Number(form.transport) + Number(form.base) * (Number(form.inps_pct) / 100);
  return (
    <div className="space-y-3">
      <Input label="Salario base (€/mes)" aria-label="Salario base (€/mes)" type="number" min="0" step="1" value={form.base} onChange={set('base')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Subsidio alimentacao" aria-label="Subsidio alimentacao" type="number" min="0" step="1" value={form.food} onChange={set('food')} />
        <Input label="Subsidio transporte" aria-label="Subsidio transporte" type="number" min="0" step="1" value={form.transport} onChange={set('transport')} />
      </div>
      <Input label="INPS patronal (%)" aria-label="INPS patronal (%)" type="number" min="0" max="100" step="0.5" value={form.inps_pct} onChange={set('inps_pct')} hint="Default: 15% (Cabo Verde)" />
      <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm flex justify-between">
        <span className="text-xs font-body text-n-500">Custo total mensal</span>
        <span className="font-display font-bold text-sm text-[var(--error)]">€{Math.round(total).toLocaleString('pt-PT')}</span>
      </div>
      <div className="flex gap-3"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button icon={Save} onClick={() => onSave({ base: Number(form.base), food: Number(form.food), transport: Number(form.transport), inps_pct: Number(form.inps_pct) })} className="flex-1">Guardar</Button></div>
    </div>
  );
}

export default SalariosTab;
