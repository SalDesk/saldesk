import { useState, useEffect } from 'react';
import {
  Users2, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Building2, Euro, FileText, Check,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import { listGroups, createGroup, updateGroup, deleteGroup, createGroupPayment } from '../services/groupsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import FilterChips from '../components/ui/FilterChips';
import EmptyState from '../components/ui/EmptyState';
import Input, { Textarea, Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData, useLingua } from '../utils/formatoLingua';
import { euroPreco } from '../utils/formatoVendedor';
import { eurosDuasCasas } from '../utils/formatoEuros';
import { eurosInteiros } from './reservations/shared';

/* tipos de evento e estados gravados; os rotulos vem de groupsPage.eventTypes e groupsPage.statuses */
const EVENT_TYPES = ['team_building', 'incentivo', 'turismo', 'casamento', 'outro'];

const STATUSES = [
  { value: 'pedido',           variant: 'default'   },
  { value: 'em_analise',       variant: 'pending'   },
  { value: 'proposta_enviada', variant: 'info'      },
  { value: 'confirmado',       variant: 'confirmed' },
  { value: 'concluido',        variant: 'default'   },
  { value: 'cancelado',        variant: 'cancelled' },
];

/* Rotulo pelo valor gravado; um valor que nao conhece mostra-se tal e qual */
function rotuloEstado(valor, t) {
  return STATUSES.some(s => s.value === valor) ? t(`groupsPage.statuses.${valor}`) : valor;
}
function rotuloTipoEvento(valor, t) {
  return EVENT_TYPES.includes(valor) ? t(`groupsPage.eventTypes.${valor}`) : valor;
}

function fmtDate(d, lang) {
  if (!d) return '—';
  return formatarData(new Date(d + 'T00:00:00Z'), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }, lang);
}

/* ── GroupModal ── */
function GroupModal({ group, units, onSave, onClose }) {
  const t = useT();
  const lang = useLingua();
  const isNew = !group || group._new;
  const base  = isNew ? null : group;

  const [form, setForm] = useState({
    company:       base?.company       || '',
    event_type:    base?.event_type    || 'team_building',
    tour_ids:      base?.tour_ids      || [],
    date:          base?.date          || '',
    guests:        base?.guests        || '',
    budget:        base?.budget        || '',
    notes:         base?.notes         || '',
    discount_pct:  base?.discount_pct  || '',
    signal_pct:    base?.signal_pct    || 30,
    days_before:   base?.days_before   || 7,
    proposal_expires: base?.proposal_expires || '',
    status:        base?.status        || 'pedido',
  });

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function toggleTour(id) {
    setForm(p => ({
      ...p,
      tour_ids: p.tour_ids.includes(id)
        ? p.tour_ids.filter(x => x !== id)
        : [...p.tour_ids, id],
    }));
  }

  const basePrice = form.tour_ids
    .map(id => Number(units.find(u => u.id === id)?.base_price || 0))
    .reduce((s, p) => s + p, 0);

  const groupPrice = basePrice > 0 && form.discount_pct
    ? basePrice * (1 - Number(form.discount_pct) / 100) * Number(form.guests || 1)
    : basePrice * Number(form.guests || 1);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(base?.id, {
        ...form,
        guests:       Number(form.guests),
        budget:       form.budget ? Number(form.budget) : 0,
        discount_pct: form.discount_pct ? Number(form.discount_pct) : 0,
        signal_pct:   Number(form.signal_pct),
        days_before:  Number(form.days_before),
      });
    } catch {
      setError(t('groupsPage.modal.errSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('groupsPage.modal.titleNew') : t('groupsPage.modal.titleEdit')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t('groupsPage.modal.company')} aria-label={t('groupsPage.modal.company')} value={form.company} onChange={set('company')} required placeholder={t('groupsPage.modal.companyPlaceholder')} />
          <Select label={t('groupsPage.modal.eventType')} aria-label={t('groupsPage.modal.eventType')} value={form.event_type} onChange={set('event_type')}>
            {EVENT_TYPES.map(v => <option key={v} value={v}>{t(`groupsPage.eventTypes.${v}`)}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('groupsPage.modal.date')} aria-label={t('groupsPage.modal.date')} type="date" value={form.date} onChange={set('date')} />
          <Input label={t('groupsPage.modal.guests')} aria-label={t('groupsPage.modal.guests')} type="number" min="1" value={form.guests} onChange={set('guests')} required placeholder={t('groupsPage.modal.guestsPlaceholder')} />
        </div>

        {/* Tours */}
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
            {t('groupsPage.modal.requestedTours', { n: form.tour_ids.length })}
          </label>
          {units.length === 0 ? (
            <p className="text-xs font-body text-n-400">{t('groupsPage.modal.noTours')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {units.map(u => (
                <button key={u.id} type="button" onClick={() => toggleTour(u.id)}
                  className={`text-xs px-3 py-1.5 rounded-sm border font-body transition-colors ${
                    form.tour_ids.includes(u.id)
                      ? 'bg-ocean-700 text-white border-ocean-700'
                      : 'bg-white text-n-600 border-n-200 hover:border-ocean-300'
                  }`}>
                  {u.base_price > 0 ? t('groupsPage.modal.tourPrice', { name: u.name, price: euroPreco(u.base_price, lang) }) : u.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('groupsPage.modal.discount')} aria-label={t('groupsPage.modal.discount')} type="number" min="0" max="50" step="1"
            value={form.discount_pct} onChange={set('discount_pct')} placeholder={t('groupsPage.modal.discountPlaceholder')} />
          <Input label={t('groupsPage.modal.budget')} aria-label={t('groupsPage.modal.budget')} type="number" min="0"
            value={form.budget} onChange={set('budget')} placeholder={t('groupsPage.modal.budgetPlaceholder')} />
        </div>

        {groupPrice > 0 && (
          <div className="px-3 py-2 bg-ocean-50 border border-ocean-100 rounded-sm">
            <p className="text-xs font-body text-ocean-700">
              {t('groupsPage.modal.estimated')} <span className="font-bold">{eurosInteiros(groupPrice, lang)}</span>
              {' '}{t('groupsPage.modal.estimatedDetail', { guests: form.guests, pct: form.discount_pct || 0 })}
            </p>
          </div>
        )}

        {/* Payment conditions */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('groupsPage.modal.deposit')} aria-label={t('groupsPage.modal.deposit')} type="number" min="0" max="100"
            value={form.signal_pct} onChange={set('signal_pct')} hint={t('groupsPage.modal.depositHint')} />
          <Input label={t('groupsPage.modal.daysBefore')} aria-label={t('groupsPage.modal.daysBefore')} type="number" min="1"
            value={form.days_before} onChange={set('days_before')} hint={t('groupsPage.modal.daysBeforeHint')} />
        </div>

        <Input label={t('groupsPage.modal.proposalValidity')} aria-label={t('groupsPage.modal.proposalValidity')} type="date" value={form.proposal_expires} onChange={set('proposal_expires')} />

        <Textarea label={t('groupsPage.modal.notes')} aria-label={t('groupsPage.modal.notes')} value={form.notes} onChange={set('notes')} rows={3}
          placeholder={t('groupsPage.modal.notesPlaceholder')} />

        {!isNew && (
          <Select label={t('groupsPage.modal.status')} aria-label={t('groupsPage.modal.status')} value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{t(`groupsPage.statuses.${s.value}`)}</option>)}
          </Select>
        )}

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('groupsPage.modal.cancel')}</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? t('groupsPage.modal.create') : t('groupsPage.modal.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── PaymentModal ── */
function PaymentModal({ group, onSave, onClose }) {
  const t = useT();
  const lang = useLingua();
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  /* a descricao por omissao e texto livre do operador, na lingua do painel */
  const [note,   setNote]   = useState(t('groupsPage.payment.defaultNote'));
  const [saving, setSaving] = useState(false);

  const totalPaid = (group.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await onSave(group.id, { amount: Number(amount), date, note });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('groupsPage.payment.title', { company: group.company })} size="sm">
      <div className="space-y-4">
        <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm">
          <p className="text-xs font-body text-n-500">{t('groupsPage.payment.totalPaid')} <span className="font-bold text-n-700">{eurosDuasCasas(totalPaid, lang)}</span></p>
        </div>
        <Input label={t('groupsPage.payment.amount')} aria-label={t('groupsPage.payment.amount')} type="number" min="0.01" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)} required />
        <Input label={t('groupsPage.payment.date')} aria-label={t('groupsPage.payment.date')} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input label={t('groupsPage.payment.description')} aria-label={t('groupsPage.payment.description')} value={note} onChange={e => setNote(e.target.value)} placeholder={t('groupsPage.payment.descriptionPlaceholder')} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('groupsPage.payment.cancel')}</Button>
          <Button loading={saving} onClick={handleSave} className="flex-1">{t('groupsPage.payment.record')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── GroupCard ── */
function GroupCard({ group, units, onEdit, onDelete, onPayment, onStatusChange }) {
  const t = useT();
  const lang = useLingua();
  const [open, setOpen] = useState(false);
  const sc = STATUSES.find(s => s.value === group.status) || STATUSES[0];
  const tours = (group.tour_ids || []).map(id => units.find(u => u.id === id)).filter(Boolean);
  const totalPaid = (group.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  const nextStatus = {
    pedido: 'em_analise',
    em_analise: 'proposta_enviada',
    proposta_enviada: 'confirmado',
    confirmado: 'concluido',
  }[group.status];

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3 cursor-pointer" onClick={() => setOpen(p => !p)}
        role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(p => !p); } }}>
        <Building2 size={16} strokeWidth={1.75} className="text-n-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{group.company}</p>
          <p className="text-xs font-body text-n-500 mt-0.5">
            {EVENT_TYPES.includes(group.event_type) ? rotuloTipoEvento(group.event_type, t) : '—'}
            {' · '}{t('groupsPage.card.guestsCount', { n: group.guests ?? '' })}
            {group.date ? ` · ${fmtDate(group.date, lang)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={sc.variant}>{t(`groupsPage.statuses.${sc.value}`)}</Badge>
          {open ? <ChevronUp size={14} strokeWidth={1.75} className="text-n-400" /> : <ChevronDown size={14} strokeWidth={1.75} className="text-n-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-n-100 px-4 py-4 space-y-4 bg-n-50">
          {/* Tours */}
          {tours.length > 0 && (
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-2">{t('groupsPage.card.requestedTours')}</p>
              <div className="flex flex-wrap gap-1.5">
                {tours.map(tour => (
                  <span key={tour.id} className="text-xs bg-white border border-n-200 px-2 py-1 rounded-sm font-body text-n-700">
                    {tour.base_price > 0 ? t('groupsPage.modal.tourPrice', { name: tour.name, price: euroPreco(tour.base_price, lang) }) : tour.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Proposal conditions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('groupsPage.card.discount'), value: group.discount_pct ? `${group.discount_pct}%` : '—' },
              { label: t('groupsPage.card.deposit'), value: `${group.signal_pct || 30}%` },
              { label: t('groupsPage.card.finalPayment'), value: t('groupsPage.card.daysBefore', { n: group.days_before || 7 }) },
              { label: t('groupsPage.card.proposalUntil'), value: fmtDate(group.proposal_expires, lang) },
            ].map(m => (
              <div key={m.label}>
                <p className="text-[10px] font-mono text-n-400 uppercase tracking-wide">{m.label}</p>
                <p className="text-xs font-body text-n-700 font-semibold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          {group.notes && (
            <div>
              <p className="text-[10px] font-mono text-n-400 uppercase tracking-wide mb-1">{t('groupsPage.card.notes')}</p>
              <p className="text-xs font-body text-n-600">{group.notes}</p>
            </div>
          )}

          {/* Payments */}
          {(group.payments || []).length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-n-400 uppercase tracking-wide mb-2">{t('groupsPage.card.paymentsReceived')}</p>
              <div className="space-y-1">
                {group.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-body text-n-500">{fmtDate(p.date, lang)} · {p.note}</span>
                    <span className="font-mono font-semibold text-[var(--success)]">{eurosDuasCasas(p.amount, lang)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-n-200 mt-1">
                  <span className="font-body font-semibold text-n-700">{t('groupsPage.card.totalPaid')}</span>
                  <span className="font-mono font-semibold text-n-800">{eurosDuasCasas(totalPaid, lang)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {nextStatus && (
              <Button size="sm" variant="secondary" icon={Check}
                onClick={() => onStatusChange(group.id, nextStatus)}>
                {t('groupsPage.card.advance', { status: t(`groupsPage.statuses.${nextStatus}`) })}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={Euro}
              onClick={() => onPayment(group)}>
              {t('groupsPage.card.recordPayment')}
            </Button>
            <Button size="sm" variant="secondary" icon={FileText}
              onClick={() => window.print()}>
              {t('groupsPage.card.printProposal')}
            </Button>
            <button onClick={() => onEdit(group)} aria-label={t('groupsPage.card.editAria', { name: group.company })}
              className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
              <Pencil size={13} strokeWidth={1.75} />
            </button>
            <button onClick={() => onDelete(group.id)} aria-label={t('groupsPage.card.deleteAria', { name: group.company })}
              className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors">
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Groups() {
  const t = useT();
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [units,       setUnits]       = useState([]);
  const [modal,       setModal]       = useState(null);
  const [payModal,    setPayModal]    = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search,      setSearch]      = useState('');

  useEffect(() => { listUnits().then(d => setUnits(d || [])).catch(() => {}); }, []);
  useEffect(() => {
    listGroups().then(d => setGroups(d || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(id, dados) {
    const saved = id ? await updateGroup(id, dados) : await createGroup(dados);
    setGroups(prev => prev.find(g => g.id === saved.id) ? prev.map(g => g.id === saved.id ? saved : g) : [saved, ...prev]);
    setModal(null);
  }

  async function handleDelete(id) {
    if (!window.confirm(t('groupsPage.confirmDelete'))) return;
    await deleteGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));
  }

  async function handlePayment(groupId, payment) {
    const updated = await createGroupPayment(groupId, payment);
    setGroups(prev => prev.map(g => g.id === groupId ? updated : g));
  }

  async function handleStatusChange(id, newStatus) {
    const updated = await updateGroup(id, { status: newStatus });
    setGroups(prev => prev.map(g => g.id === id ? updated : g));
  }

  const filtered = groups.filter(g => {
    if (filterStatus && g.status !== filterStatus) return false;
    if (search && !g.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const kpis = {
    total:      groups.length,
    confirmados: groups.filter(g => g.status === 'confirmado').length,
    pax:        groups.filter(g => ['confirmado', 'concluido'].includes(g.status)).reduce((s, g) => s + (g.guests || 0), 0),
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={t('groupsPage.title')} subtitle={t('groupsPage.subtitle')} />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('groupsPage.title')}
        subtitle={t('groupsPage.subtitle')}
        actions={<Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('groupsPage.newQuote')}</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: t('groupsPage.kpi.total'),      value: kpis.total,       color: 'text-n-900'     },
          { label: t('groupsPage.kpi.confirmed'),  value: kpis.confirmados, color: 'text-[var(--success)]' },
          { label: t('groupsPage.kpi.guests'),     value: kpis.pax,         color: 'text-ocean-700' },
        ].map(m => (
          <Card key={m.label} padding="px-4 py-3">
            <div className="flex items-center gap-3">
              <Users2 size={16} strokeWidth={1.75} className="text-n-300 shrink-0" />
              <div>
                <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                <p className="text-xs font-body text-n-500">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <Input aria-label={t('groupsPage.searchAria')} value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('groupsPage.searchPlaceholder')} />
        </div>
        <FilterChips
          options={[{ value: '', label: t('groupsPage.all') }, ...STATUSES.map(st => ({ value: st.value, label: rotuloEstado(st.value, t) }))]}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {sorted.length === 0 ? (
        <Card padding="p-0">
          <EmptyState icon={Users2} title={t('groupsPage.empty.title')}
            description={groups.length === 0
              ? t('groupsPage.empty.first')
              : t('groupsPage.empty.filtered')}
            action={groups.length === 0 ? <Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('groupsPage.newQuote')}</Button> : undefined} />
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map(g => (
            <GroupCard
              key={g.id}
              group={g}
              units={units}
              onEdit={setModal}
              onDelete={handleDelete}
              onPayment={setPayModal}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {modal && <GroupModal group={modal} units={units} onSave={handleSave} onClose={() => setModal(null)} />}
      {payModal && (
        <PaymentModal
          group={payModal}
          onSave={handlePayment}
          onClose={() => setPayModal(null)}
        />
      )}
    </div>
  );
}
