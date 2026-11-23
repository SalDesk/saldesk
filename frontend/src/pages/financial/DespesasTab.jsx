import { useState, useEffect } from 'react';
import {
  TrendingDown,
  Edit2,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';
import { listExpenses, addExpenseLocal, updateExpenseLocal, deleteExpenseLocal } from '../../services/expensesService';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Toggle from '../../components/ui/Toggle';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input, { Textarea, Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { EXPENSE_CATEGORIES, CAT_COLORS, rotuloCategoriaDespesa, fmtDate, fmtMoney, fmtDica } from './shared';
import { rotuloCargo } from '../staff/shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

/* ─────────────────── DESPESAS ─────────────────── */

function ExpenseModal({ expense, staff, onSave, onClose }) {
  const t = useT();
  const lang = useLingua();
  const isNew = !expense || expense._new;
  const base  = isNew ? null : expense;
  const [form, setForm] = useState({
    category:     base?.category     || EXPENSE_CATEGORIES[0],
    amount:       base?.amount       || '',
    currency:     base?.currency     || 'EUR',
    date:         base?.date         || new Date().toISOString().slice(0, 10),
    staff_id:     base?.staff_id     || '',
    is_recurring: base?.is_recurring || false,
    notes:        base?.notes        || '',
    receipt_url:  base?.receipt_url  || '',
  });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...base, ...form, amount: Number(form.amount), id: base?.id || Date.now().toString() });
  }
  return (
    <Modal open onClose={onClose} title={isNew ? t('financial.expenses.recordTitle') : t('financial.expenses.editTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('financial.form.category')} aria-label={t('financial.form.category')} value={form.category} onChange={set('category')}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{rotuloCategoriaDespesa(c, t, lang)}</option>)}
          </Select>
          <Select label={t('financial.form.currency')} aria-label={t('financial.form.currency')} value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR (€)</option>
            <option value="CVE">CVE</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('financial.form.amount')} aria-label={t('financial.form.amount')} type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} required placeholder="0.00" />
          <Input label={t('financial.form.date')} aria-label={t('financial.form.date')} type="date" value={form.date} onChange={set('date')} required />
        </div>
        {['Salarios', 'Comissoes vendedores'].includes(form.category) && staff.length > 0 && (
          <Select label={t('financial.columns.staff')} aria-label={t('financial.columns.staff')} value={form.staff_id} onChange={set('staff_id')}>
            <option value="">{t('financial.expenses.noStaff')}</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({rotuloCargo(s.role, t, lang)})</option>)}
          </Select>
        )}
        <Toggle checked={form.is_recurring} onChange={v => setForm(p => ({ ...p, is_recurring: v }))} label={t('financial.expenses.recurringToggle')} />
        <Textarea label={t('financial.form.notes')} aria-label={t('financial.form.notes')} value={form.notes} onChange={set('notes')} rows={2} />
        <Input label={t('financial.form.receiptUrl')} aria-label={t('financial.form.receiptUrl')} value={form.receipt_url} onChange={set('receipt_url')} placeholder="https://..." />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" className="flex-1">{isNew ? t('financial.form.record') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DespesasTab({ currency, staff }) {
  const lang = useLingua();
  const t = useT();
  const rotulo = (cat) => rotuloCategoriaDespesa(cat, t, lang);
  const [expenses,    setExpenses]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);
  const [filterCat,   setFilterCat]   = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setLoading(true);
    listExpenses().then(d => setExpenses(d || [])).finally(() => setLoading(false));
  }, []);

  async function handleSave(exp) {
    if (exp.id && expenses.find(e => e.id === exp.id)) {
      const updated = await updateExpenseLocal(exp.id, exp);
      setExpenses(prev => prev.map(e => e.id === exp.id ? updated : e));
    } else {
      const added = await addExpenseLocal(exp);
      setExpenses(prev => [...prev, added]);
    }
    setModal(null);
  }

  async function handleDelete(id) {
    if (!window.confirm(t('financial.expenses.confirmDelete'))) return;
    await deleteExpenseLocal(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  const periodExp = expenses.filter(e => {
    const d = e.date || '';
    const monthMatch = !filterMonth || d.startsWith(filterMonth);
    const catMatch   = !filterCat   || e.category === filterCat;
    return monthMatch && catMatch;
  });

  const totalPeriod = periodExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  /* Category summary: cat e o valor gravado, name o rotulo na lingua do painel */
  const byCat = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    name: rotulo(cat),
    total: periodExp.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  /* Recurring alerts */
  const recurring = expenses.filter(e => e.is_recurring);
  const thisMonth = filterMonth;
  const missingRecurring = recurring.filter(r => !expenses.some(e => e.category === r.category && !e.is_recurring && (e.date || '').startsWith(thisMonth)));

  /* Chart data */
  const chartData = byCat.slice(0, 8).map(({ name, total }) => ({ name, total }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return <div className="bg-white border border-n-200 rounded-sm shadow-sm px-3 py-2 text-xs font-body"><p className="font-semibold text-n-700">{payload[0].name}</p><p style={{ color: payload[0].payload.fill }}>{fmtDica(payload[0].value, 'EUR')}</p></div>;
  };

  const columns = [
    { key: 'data', label: t('financial.columns.date'), render: e => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(e.date)}</span> },
    { key: 'categoria', label: t('financial.columns.category'), render: e => <span className="font-body font-semibold text-n-800">{rotulo(e.category)}</span> },
    { key: 'colaborador', label: t('financial.columns.staff'), render: e => <span className="text-xs font-body text-n-500">{e.staff_id ? (staff.find(s => s.id === e.staff_id)?.name || '—') : '—'}</span> },
    { key: 'valor', label: t('financial.columns.value'), render: e => <span className="font-display font-bold text-[var(--error)] whitespace-nowrap">- {fmtMoney(e.amount, currency)}</span> },
    { key: 'recorrente', label: t('financial.columns.recurring'), render: e => (e.is_recurring ? <span className="text-xs font-mono text-ocean-700 bg-ocean-50 px-1.5 py-0.5 rounded-xs">{t('financial.columns.recurring')}</span> : '—') },
    { key: 'notas', label: t('financial.columns.notes'), render: e => <span className="block max-w-[150px] truncate text-xs font-body text-n-500">{e.notes || '—'}</span> },
    {
      key: 'acoes', label: '',
      render: e => (
        <div className="flex gap-0.5">
          <button aria-label={t('financial.expenses.editAria', { category: rotulo(e.category) })} onClick={() => setModal(e)} className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button>
          <button aria-label={t('financial.expenses.deleteAria', { category: rotulo(e.category) })} onClick={() => handleDelete(e.id)} className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors"><Trash2 size={13} strokeWidth={1.75} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {missingRecurring.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm">
          <AlertTriangle size={15} strokeWidth={1.75} className="text-[var(--warning)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-body font-semibold text-[var(--warning)]">{t('financial.expenses.missingRecurring')}</p>
            <p className="text-xs font-body text-[var(--warning)] mt-0.5">{missingRecurring.slice(0, 3).map(r => rotulo(r.category)).join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Input type="month" aria-label={t('financial.form.month')} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </div>
        <div className="w-56">
          <Select aria-label={t('financial.form.category')} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">{t('financial.form.allCategories')}</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{rotulo(c)}</option>)}
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-mono text-n-500">{t('financial.form.total')} <span className="font-bold text-n-800">{fmtDica(totalPeriod, 'EUR')}</span></span>
          <Button icon={Plus} size="sm" onClick={() => setModal({ _new: true })}>{t('financial.expenses.recordTitle')}</Button>
        </div>
      </div>

      {/* Summary cards */}
      {byCat.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {byCat.slice(0, 4).map((c, i) => (
            <Card key={c.cat} padding="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i] }} />
                <p className="text-xs font-body text-n-500 truncate">{c.name}</p>
              </div>
              <p className="font-display font-bold text-lg text-n-900">{fmtDica(c.total, 'EUR')}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card padding="px-5 pb-5 pt-3" header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.expenses.byCategory')}</h3>}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {chartData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Pie>
                <ChartTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card padding="px-5 pb-5 pt-3" header={<h3 className="font-display font-semibold text-sm text-n-700">{t('financial.expenses.details')}</h3>}>
            <div className="space-y-2 mt-2">
              {byCat.map((c, i) => (
                <div key={c.cat} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <span className="text-xs font-body text-n-600 flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-mono font-semibold text-n-800">{fmtDica(c.total, 'EUR')}</span>
                  <span className="text-xs font-mono text-n-400 w-10 text-right">{totalPeriod > 0 ? ((c.total / totalPeriod) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* List */}
      {loading ? <div className="flex justify-center py-12"><LoadingSpinner size={32} /></div> :
       periodExp.length === 0 ? (
        <Card padding="p-0"><EmptyState icon={TrendingDown} title={t('financial.expenses.empty')} /></Card>
      ) : (
        <Card padding="p-0">
          <Table columns={columns} rows={[...periodExp].sort((a, b) => (b.date || '').localeCompare(a.date || ''))} compact />
        </Card>
      )}

      {modal && <ExpenseModal expense={modal} staff={staff} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
}

export default DespesasTab;
