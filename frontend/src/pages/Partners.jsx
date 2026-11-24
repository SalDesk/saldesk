import { useState, useEffect, useRef } from 'react';
import {
  Handshake, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  Hotel, Car, Utensils, Compass, ToggleLeft, ToggleRight, Check, X, Clock,
} from 'lucide-react';
import {
  listPartners, createPartner, updatePartner, deletePartner, registerPartnerBooking,
  searchOperators, requestPartnership, respondPartnership,
} from '../services/partnersService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Tabs from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { useLingua } from '../utils/formatoLingua';
import { euroPreco } from '../utils/formatoVendedor';
import { eurosInteiros } from './reservations/shared';

/* tipos de parceiro e de parceria gravados; os rotulos vem de partnersPage.types e partnersPage.partnershipTypes */
const PARTNER_TYPES = [
  { value: 'hotel',      Icon: Hotel   },
  { value: 'activity',   Icon: Compass },
  { value: 'rentacar',   Icon: Car     },
  { value: 'restaurant', Icon: Utensils },
];

const PARTNERSHIP_TYPES = ['recommendation', 'commission', 'discount'];

/* tipo de parceiro desconhecido mostra-se como o primeiro (hotel), como sempre foi */
function tipoParceiro(value) {
  return PARTNER_TYPES.find(p => p.value === value) || PARTNER_TYPES[0];
}
function tipoParceria(value) {
  return PARTNERSHIP_TYPES.includes(value) ? value : PARTNERSHIP_TYPES[0];
}

/* ── OperatorPicker: pesquisa com debounce sobre operadores reais ── */
function OperatorPicker({ selected, onSelect }) {
  const t = useT();
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      searchOperators(query.trim()).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  if (selected) {
    const typeInfo = tipoParceiro(selected.operator_type);
    return (
      <div className="flex items-center gap-3 border border-n-200 rounded-sm px-3 py-2.5 bg-n-50">
        <div className="w-8 h-8 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
          <typeInfo.Icon size={16} strokeWidth={1.75} className="text-ocean-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{selected.name}</p>
          <p className="text-xs font-body text-n-500">{t(`partnersPage.types.${typeInfo.value}`)}</p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="text-xs font-body text-ocean-700 hover:underline shrink-0">
          {t('partnersPage.picker.change')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query} onChange={e => setQuery(e.target.value)}
        placeholder={t('partnersPage.picker.placeholder')} aria-label={t('partnersPage.picker.aria')}
      />
      {query.trim().length >= 2 && (
        <div className="mt-1 border border-n-200 rounded-sm bg-white shadow-sm max-h-48 overflow-y-auto">
          {searching && <p className="text-xs font-body text-n-400 px-3 py-2">{t('partnersPage.picker.searching')}</p>}
          {!searching && results.length === 0 && (
            <p className="text-xs font-body text-n-400 px-3 py-2">{t('partnersPage.picker.none')}</p>
          )}
          {results.map(op => {
            const typeInfo = tipoParceiro(op.operator_type);
            return (
              <button key={op.id} type="button" onClick={() => onSelect(op)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ocean-50 transition-colors text-left">
                <typeInfo.Icon size={15} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
                <div className="min-w-0">
                  <p className="font-body font-semibold text-sm text-n-900 truncate">{op.name}</p>
                  <p className="text-xs font-body text-n-400">{t(`partnersPage.types.${typeInfo.value}`)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── PartnerModal ── */
function PartnerModal({ partner, onSave, onRequest, onClose }) {
  const t = useT();
  const isNew = !partner || partner._new;
  const base  = isNew ? null : partner;
  const isRealPartner = !!base?.partner_operator_id;

  const [mode, setMode] = useState(isRealPartner ? 'real' : 'manual');
  const [selectedOperator, setSelectedOperator] = useState(
    isRealPartner ? { id: base.partner_operator_id, name: base.name, operator_type: base.partner_type } : null
  );

  const [form, setForm] = useState({
    name:               base?.name               || '',
    partner_type:       base?.partner_type       || 'hotel',
    partnership_type:   base?.partnership_type   || 'recommendation',
    commission_pct:     base?.commission_pct     || '',
    avg_booking_value:  base?.avg_booking_value  || '',
    message_pt:         base?.message_pt         || '',
    message_en:         base?.message_en         || '',
    active:             base?.active             ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'real' && isNew && !selectedOperator) {
      setError(t('partnersPage.modal.errChoose'));
      return;
    }

    setSaving(true);
    try {
      const dadosComuns = {
        partnership_type:  form.partnership_type,
        commission_pct:    form.commission_pct ? Number(form.commission_pct) : 0,
        avg_booking_value: form.avg_booking_value ? Number(form.avg_booking_value) : 0,
        message_pt: form.message_pt,
        message_en: form.message_en,
      };

      if (mode === 'real' && isNew) {
        await onRequest(selectedOperator.id, dadosComuns);
      } else {
        await onSave(base?.id, { ...dadosComuns, name: form.name, partner_type: form.partner_type, active: form.active });
      }
    } catch (err) {
      setError(mensagemErro(err, t, t('partnersPage.modal.errSave')));
    } finally {
      setSaving(false);
    }
  }

  const needsCommission = form.partnership_type === 'commission';
  const needsMessage    = form.partnership_type !== 'discount';

  return (
    <Modal open onClose={onClose} title={isNew ? t('partnersPage.modal.titleNew') : t('partnersPage.modal.titleEdit')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {isNew && (
          <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
            {[{ v: 'manual', l: t('partnersPage.modal.modeManual') }, { v: 'real', l: t('partnersPage.modal.modeReal') }].map(o => (
              <button key={o.v} type="button" aria-pressed={mode === o.v} onClick={() => setMode(o.v)}
                className={`flex-1 py-1.5 text-xs font-body font-semibold rounded-xs transition-colors ${mode === o.v ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
                {o.l}
              </button>
            ))}
          </div>
        )}

        {mode === 'manual' && (
          <>
            <Input label={t('partnersPage.modal.name')} aria-label={t('partnersPage.modal.name')} value={form.name} onChange={set('name')} required placeholder={t('partnersPage.modal.namePlaceholder')} />
            <Select label={t('partnersPage.modal.partnerType')} aria-label={t('partnersPage.modal.partnerType')} value={form.partner_type} onChange={set('partner_type')}>
              {PARTNER_TYPES.map(p => <option key={p.value} value={p.value}>{t(`partnersPage.types.${p.value}`)}</option>)}
            </Select>
          </>
        )}

        {mode === 'real' && (
          <div>
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">{t('partnersPage.modal.operatorLabel')}</label>
            {isRealPartner ? (
              <OperatorPicker selected={selectedOperator} onSelect={() => {}} />
            ) : (
              <OperatorPicker selected={selectedOperator} onSelect={setSelectedOperator} />
            )}
            {!isRealPartner && (
              <p className="text-xs font-body text-n-400 mt-1">
                {t('partnersPage.modal.pendingHint')}
              </p>
            )}
          </div>
        )}

        <Select label={t('partnersPage.modal.partnershipType')} aria-label={t('partnersPage.modal.partnershipType')} value={form.partnership_type} onChange={set('partnership_type')}>
          {PARTNERSHIP_TYPES.map(v => <option key={v} value={v}>{t(`partnersPage.partnershipTypes.${v}`)}</option>)}
        </Select>

        {needsCommission && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('partnersPage.modal.commission')} aria-label={t('partnersPage.modal.commission')}
              type="number" min="0" max="50" step="0.5"
              value={form.commission_pct} onChange={set('commission_pct')}
              placeholder={t('partnersPage.modal.commissionPlaceholder')}
              hint={t('partnersPage.modal.commissionHint')}
            />
            <Input
              label={t('partnersPage.modal.avgValue')} aria-label={t('partnersPage.modal.avgValue')}
              type="number" min="0" step="1"
              value={form.avg_booking_value} onChange={set('avg_booking_value')}
              placeholder={t('partnersPage.modal.avgPlaceholder')}
              hint={t('partnersPage.modal.avgHint')}
            />
          </div>
        )}

        {needsMessage && (
          <>
            <Textarea label={t('partnersPage.modal.messagePt')} aria-label={t('partnersPage.modal.messagePt')} value={form.message_pt} onChange={set('message_pt')} rows={3}
              placeholder={t('partnersPage.modal.messagePtPlaceholder')} />
            <Textarea label={t('partnersPage.modal.messageEn')} aria-label={t('partnersPage.modal.messageEn')} value={form.message_en} onChange={set('message_en')} rows={3}
              placeholder={t('partnersPage.modal.messageEnPlaceholder')} />
          </>
        )}

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('partnersPage.modal.cancel')}</Button>
          <Button type="submit" loading={saving} className="flex-1">
            {mode === 'real' && isNew ? t('partnersPage.modal.sendRequest') : (isNew ? t('partnersPage.modal.add') : t('partnersPage.modal.save'))}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── BookingLogModal ── */
function BookingLogModal({ partner, onSave, onClose }) {
  const t = useT();
  const [direction, setDirection] = useState('sent');
  const [count,     setCount]     = useState('1');
  const [saving,    setSaving]    = useState(false);

  async function handleSave() {
    const delta = Number(count) || 1;
    setSaving(true);
    try {
      await onSave(partner.id, direction, delta);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('partnersPage.log.title', { name: partner.name })} size="sm">
      <div className="space-y-4">
        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {[{ v: 'sent', l: t('partnersPage.log.sent') }, { v: 'received', l: t('partnersPage.log.received') }].map(o => (
            <button key={o.v} type="button" aria-pressed={direction === o.v} onClick={() => setDirection(o.v)}
              className={`flex-1 py-1.5 text-xs font-body font-semibold rounded-xs transition-colors ${direction === o.v ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <Input label={t('partnersPage.log.count')} aria-label={t('partnersPage.log.count')} type="number" min="1" step="1" value={count} onChange={e => setCount(e.target.value)} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('partnersPage.log.cancel')}</Button>
          <Button loading={saving} onClick={handleSave} className="flex-1">{t('partnersPage.log.record')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Partners() {
  const t = useT();
  const lang = useLingua();
  const { operator } = useAuthStore();
  const [partners,  setPartners]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [logModal,  setLogModal]  = useState(null);
  const [activeTab, setActiveTab] = useState('parceiros');
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    listPartners().then(d => setPartners(d || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(id, dados) {
    const saved = id ? await updatePartner(id, dados) : await createPartner(dados);
    setPartners(prev => prev.find(p => p.id === saved.id) ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
    setModal(null);
  }

  async function handleRequestPartnership(partnerOperatorId, dados) {
    const saved = await requestPartnership({ partner_operator_id: partnerOperatorId, ...dados });
    setPartners(prev => [saved, ...prev]);
    setModal(null);
  }

  async function handleRespond(id, status) {
    setResponding(id);
    try {
      const saved = await respondPartnership(id, status);
      setPartners(prev => prev.map(p => p.id === id ? saved : p));
    } finally {
      setResponding(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('partnersPage.confirmDelete'))) return;
    await deletePartner(id);
    setPartners(prev => prev.filter(p => p.id !== id));
  }

  async function handleToggle(p) {
    const updated = await updatePartner(p.id, { active: !p.active });
    setPartners(prev => prev.map(x => x.id === p.id ? updated : x));
  }

  async function handleLogBooking(partnerId, direction, delta) {
    const updated = await registerPartnerBooking(partnerId, direction, delta);
    setPartners(prev => prev.map(p => p.id === partnerId ? updated : p));
  }

  const myOperatorId    = operator?.id;
  const activePartners  = partners.filter(p => p.status !== 'pending');
  const pendingReceived = partners.filter(p => p.status === 'pending' && p.requested_by_operator_id !== myOperatorId);
  const pendingSent     = partners.filter(p => p.status === 'pending' && p.requested_by_operator_id === myOperatorId);

  /* Dashboard stats -- so sobre parcerias activas, nunca pendentes/recusadas */
  const totalSent      = activePartners.reduce((s, p) => s + (p.bookings_sent || 0), 0);
  const totalReceived  = activePartners.reduce((s, p) => s + (p.bookings_received || 0), 0);
  const commPayable    = activePartners
    .filter(p => p.partnership_type === 'commission' && p.commission_pct > 0)
    .reduce((s, p) => s + (p.bookings_sent || 0) * (p.avg_booking_value || 0) * (p.commission_pct / 100), 0);
  const commReceivable = activePartners
    .filter(p => p.partnership_type === 'commission' && p.commission_pct > 0)
    .reduce((s, p) => s + (p.bookings_received || 0) * (p.avg_booking_value || 0) * (p.commission_pct / 100), 0);

  const TABS = [
    { id: 'parceiros', label: t('partnersPage.tabs.partners') },
    { id: 'pedidos',   label: t('partnersPage.tabs.requests'), count: pendingReceived.length > 0 ? pendingReceived.length : undefined },
    { id: 'dashboard', label: t('partnersPage.tabs.dashboard') },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={t('partnersPage.title')} subtitle={t('partnersPage.subtitle')} />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('partnersPage.title')}
        subtitle={t('partnersPage.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('partnersPage.addPartner')}</Button>
        }
      />

      <div className="mb-5">
        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'parceiros' && (
        activePartners.length === 0 ? (
          <Card padding="p-0">
            <EmptyState
              icon={Handshake}
              title={t('partnersPage.empty.title')}
              description={t('partnersPage.empty.description')}
              action={<Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('partnersPage.addPartner')}</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {activePartners.map(p => {
              const typeInfo = tipoParceiro(p.partner_type);
              const pshipType = tipoParceria(p.partnership_type);
              const isRejected = p.status === 'rejected';
              return (
                <Card key={p.id} padding="px-4 py-4 flex items-start gap-4" className={(!p.active || isRejected) ? 'opacity-60' : ''}>
                  <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                    <typeInfo.Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-semibold text-sm text-n-900 flex items-center gap-1.5">
                          {p.name}
                          {p.partner_operator_id && <Badge variant="info">SalDesk</Badge>}
                          {isRejected && <Badge variant="cancelled">{t('partnersPage.rejected')}</Badge>}
                        </p>
                        <p className="text-xs font-body text-n-500 mt-0.5">{t(`partnersPage.types.${typeInfo.value}`)} · {t(`partnersPage.partnershipTypes.${pshipType}`)}</p>
                        {p.commission_pct > 0 && (
                          <p className="text-xs font-mono text-n-400 mt-0.5">
                            {t('partnersPage.commissionLine', { pct: p.commission_pct })}{p.avg_booking_value > 0 ? t('partnersPage.avgBookingLine', { amount: euroPreco(p.avg_booking_value, lang) }) : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-center">
                        <div>
                          <p className="font-display font-bold text-sm text-ocean-700">{p.bookings_sent || 0}</p>
                          <p className="text-[9px] font-mono text-n-400">{t('partnersPage.bookingsSent')}</p>
                        </div>
                        <div>
                          <p className="font-display font-bold text-sm text-[var(--success)]">{p.bookings_received || 0}</p>
                          <p className="text-[9px] font-mono text-n-400">{t('partnersPage.bookingsReceived')}</p>
                        </div>
                      </div>
                    </div>
                    {p.message_pt && (
                      <p className="text-xs font-body text-n-500 mt-2 line-clamp-1">{p.message_pt}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => setLogModal(p)} aria-label={t('partnersPage.actions.recordAria', { name: p.name })}
                      className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title={t('partnersPage.actions.record')}>
                      <Handshake size={13} strokeWidth={1.75} />
                    </button>
                    <button type="button" onClick={() => handleToggle(p)} aria-label={t(p.active ? 'partnersPage.actions.deactivateAria' : 'partnersPage.actions.activateAria', { name: p.name })}
                      className="p-1.5 rounded text-n-400 hover:text-n-700 hover:bg-n-100 transition-colors">
                      {p.active
                        ? <ToggleRight size={13} strokeWidth={1.75} className="text-ocean-700" />
                        : <ToggleLeft size={13} strokeWidth={1.75} />}
                    </button>
                    <button type="button" onClick={() => setModal(p)} aria-label={t('partnersPage.actions.editAria', { name: p.name })}
                      className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                    <button type="button" onClick={() => handleDelete(p.id)} aria-label={t('partnersPage.actions.deleteAria', { name: p.name })}
                      className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors">
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'pedidos' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display font-semibold text-sm text-n-700 mb-2">{t('partnersPage.requests.received')}</h3>
            {pendingReceived.length === 0 ? (
              <p className="text-sm font-body text-n-400">{t('partnersPage.requests.noneReceived')}</p>
            ) : (
              <div className="space-y-2">
                {pendingReceived.map(p => (
                  <Card key={p.id} padding="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                      <Handshake size={16} strokeWidth={1.75} className="text-ocean-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-sm text-n-900">{p.name}</p>
                      <p className="text-xs font-body text-n-500">
                        {t(`partnersPage.partnershipTypes.${tipoParceria(p.partnership_type)}`)}
                        {p.commission_pct > 0 ? ` · ${t('partnersPage.commissionLine', { pct: p.commission_pct })}` : ''}
                      </p>
                    </div>
                    <Button size="sm" icon={Check} loading={responding === p.id} onClick={() => handleRespond(p.id, 'accepted')}>{t('partnersPage.requests.accept')}</Button>
                    <Button size="sm" variant="secondary" icon={X} loading={responding === p.id} onClick={() => handleRespond(p.id, 'rejected')}>{t('partnersPage.requests.reject')}</Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-display font-semibold text-sm text-n-700 mb-2">{t('partnersPage.requests.sent')}</h3>
            {pendingSent.length === 0 ? (
              <p className="text-sm font-body text-n-400">{t('partnersPage.requests.noneSent')}</p>
            ) : (
              <div className="space-y-2">
                {pendingSent.map(p => (
                  <Card key={p.id} padding="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-n-100 flex items-center justify-center shrink-0">
                      <Clock size={16} strokeWidth={1.75} className="text-n-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-sm text-n-900">{p.name}</p>
                      <p className="text-xs font-body text-n-500">{t('partnersPage.requests.awaiting')}</p>
                    </div>
                    <button type="button" onClick={() => handleDelete(p.id)} aria-label={t('partnersPage.requests.cancelAria', { name: p.name })}
                      className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors" title={t('partnersPage.requests.cancel')}>
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t('partnersPage.dashboard.activePartners'), value: activePartners.filter(p => p.active && p.status !== 'rejected').length, color: 'text-n-900' },
              { label: t('partnersPage.dashboard.sent'),           value: totalSent,                             color: 'text-ocean-700', Icon: ArrowUpRight },
              { label: t('partnersPage.dashboard.received'),       value: totalReceived,                         color: 'text-[var(--success)]', Icon: ArrowDownRight },
              { label: t('partnersPage.dashboard.balance'),        value: totalReceived - totalSent,             color: (totalReceived - totalSent) >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]' },
            ].map(m => (
              <Card key={m.label} padding="px-4 py-3">
                <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
              </Card>
            ))}
          </div>

          {activePartners.some(p => p.partnership_type === 'commission') && (
            <div className="grid grid-cols-2 gap-4">
              <Card padding="px-5 py-4">
                <h3 className="font-display font-semibold text-sm text-n-700 mb-3">{t('partnersPage.dashboard.payable')}</h3>
                <p className="font-display font-bold text-2xl text-[var(--error)]">{eurosInteiros(commPayable, lang)}</p>
                <p className="text-xs font-body text-n-400 mt-0.5">
                  {t('partnersPage.dashboard.payableHelp')}
                  <br />{t('partnersPage.dashboard.needsAvg')}
                </p>
              </Card>
              <Card padding="px-5 py-4">
                <h3 className="font-display font-semibold text-sm text-n-700 mb-3">{t('partnersPage.dashboard.receivable')}</h3>
                <p className="font-display font-bold text-2xl text-[var(--success)]">{eurosInteiros(commReceivable, lang)}</p>
                <p className="text-xs font-body text-n-400 mt-0.5">
                  {t('partnersPage.dashboard.receivableHelp')}
                  <br />{t('partnersPage.dashboard.needsAvg')}
                </p>
              </Card>
            </div>
          )}

          <div className="px-4 py-3 bg-[var(--info-light)] border border-n-200 rounded-sm">
            <p className="text-xs font-body text-[var(--info)]">
              <span className="font-semibold">{t('partnersPage.dashboard.noteLabel')}</span> {t('partnersPage.dashboard.noteText')} <span className="font-mono">{t('automations.title')}</span>.
            </p>
          </div>
        </div>
      )}

      {modal && (
        <PartnerModal partner={modal} onSave={handleSave} onRequest={handleRequestPartnership} onClose={() => setModal(null)} />
      )}
      {logModal && (
        <BookingLogModal partner={logModal} onSave={handleLogBooking} onClose={() => setLogModal(null)} />
      )}
    </div>
  );
}
