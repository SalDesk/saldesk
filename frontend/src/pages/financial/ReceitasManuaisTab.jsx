import { useState, useEffect } from 'react';
import {
  Receipt,
  Edit2,
  Plus,
  Trash2,
} from 'lucide-react';
import { getReceitasManuais, createReceitaManual, updateReceitaManual, deleteReceitaManual } from '../../services/financeiroService';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input, { Textarea, Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { MANUAL_REVENUE_CATEGORIES, CAT_COLORS, rotuloCategoriaReceita, fmtDate, fmtMoney } from './shared';
import { useLingua } from '../../utils/formatoLingua';
import { useT } from '../../i18n';

/* ─────────────────── RECEITAS MANUAIS ─────────────────── */

function ReceitaManualModal({ receita, onSave, onClose }) {
  const t = useT();
  const lang = useLingua();
  const isNew = !receita || receita._new;
  const base  = isNew ? null : receita;
  const [form, setForm] = useState({
    category:    base?.category    || MANUAL_REVENUE_CATEGORIES[0],
    amount:      base?.amount      || '',
    currency:    base?.currency    || 'EUR',
    date:        base?.date        || new Date().toISOString().slice(0, 10),
    notes:       base?.notes       || '',
    receipt_url: base?.receipt_url || '',
  });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...base, ...form, amount: Number(form.amount), id: base?.id });
  }
  return (
    <Modal open onClose={onClose} title={isNew ? t('financial.manualRevenue.recordTitle') : t('financial.manualRevenue.editTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('financial.form.category')} aria-label={t('financial.form.category')} value={form.category} onChange={set('category')}>
            {MANUAL_REVENUE_CATEGORIES.map(c => <option key={c} value={c}>{rotuloCategoriaReceita(c, t, lang)}</option>)}
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

function ReceitasManuaisTab({ currency, onChange }) {
  const lang = useLingua();
  const t = useT();
  const rotulo = (cat) => rotuloCategoriaReceita(cat, t, lang);
  const [receitas,    setReceitas]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);
  const [filterCat,   setFilterCat]   = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setLoading(true);
    getReceitasManuais().then(d => setReceitas(d || [])).finally(() => setLoading(false));
  }, []);

  async function handleSave(rec) {
    if (rec.id) {
      const updated = await updateReceitaManual(rec.id, rec);
      setReceitas(prev => prev.map(r => r.id === rec.id ? updated : r));
    } else {
      const added = await createReceitaManual(rec);
      setReceitas(prev => [...prev, added]);
    }
    setModal(null);
    onChange?.();
  }

  async function handleDelete(id) {
    if (!window.confirm(t('financial.manualRevenue.confirmDelete'))) return;
    await deleteReceitaManual(id);
    setReceitas(prev => prev.filter(r => r.id !== id));
    onChange?.();
  }

  const periodRec = receitas.filter(r => {
    const d = r.date || '';
    const monthMatch = !filterMonth || d.startsWith(filterMonth);
    const catMatch    = !filterCat   || r.category === filterCat;
    return monthMatch && catMatch;
  });

  const totalPeriod = periodRec.reduce((s, r) => s + Number(r.amount || 0), 0);

  /* cat e o valor gravado, name o rotulo na lingua do painel */
  const byCat = MANUAL_REVENUE_CATEGORIES.map(cat => ({
    cat,
    name: rotulo(cat),
    total: periodRec.filter(r => r.category === cat).reduce((s, r) => s + Number(r.amount || 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const columns = [
    { key: 'data', label: t('financial.columns.date'), render: r => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(r.date)}</span> },
    { key: 'categoria', label: t('financial.columns.category'), render: r => <span className="font-body font-semibold text-n-800">{rotulo(r.category)}</span> },
    { key: 'valor', label: t('financial.columns.value'), render: r => <span className="font-display font-bold text-[var(--success)] whitespace-nowrap">+ {fmtMoney(r.amount, currency)}</span> },
    { key: 'notas', label: t('financial.columns.notes'), render: r => <span className="block max-w-[220px] truncate text-xs font-body text-n-500">{r.notes || '—'}</span> },
    {
      key: 'acoes', label: '',
      render: r => (
        <div className="flex gap-0.5">
          <button aria-label={t('financial.manualRevenue.editAria', { category: rotulo(r.category) })} onClick={() => setModal(r)} className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"><Edit2 size={13} strokeWidth={1.75} /></button>
          <button aria-label={t('financial.manualRevenue.deleteAria', { category: rotulo(r.category) })} onClick={() => handleDelete(r.id)} className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors"><Trash2 size={13} strokeWidth={1.75} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Input type="month" aria-label={t('financial.form.month')} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </div>
        <div className="w-56">
          <Select aria-label={t('financial.form.category')} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">{t('financial.form.allCategories')}</option>
            {MANUAL_REVENUE_CATEGORIES.map(c => <option key={c} value={c}>{rotulo(c)}</option>)}
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-mono text-n-500">{t('financial.form.total')} <span className="font-bold text-n-800">{fmtMoney(totalPeriod, currency)}</span></span>
          <Button icon={Plus} size="sm" onClick={() => setModal({ _new: true })}>{t('financial.manualRevenue.recordTitle')}</Button>
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
              <p className="font-display font-bold text-lg text-n-900">{fmtMoney(c.total, currency)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? <div className="flex justify-center py-12"><LoadingSpinner size={32} /></div> :
       periodRec.length === 0 ? (
        <Card padding="p-0"><EmptyState icon={Receipt} title={t('financial.manualRevenue.empty')} /></Card>
      ) : (
        <Card padding="p-0">
          <Table columns={columns} rows={[...periodRec].sort((a, b) => (b.date || '').localeCompare(a.date || ''))} compact />
        </Card>
      )}

      {modal && <ReceitaManualModal receita={modal} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
}

export default ReceitasManuaisTab;
