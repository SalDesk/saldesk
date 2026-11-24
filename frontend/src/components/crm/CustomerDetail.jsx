import { useState, useEffect } from 'react';
import {
  X, ArrowRight, Pencil, Check, Tag, Mail, MessageCircle,
  Crown, Send,
} from 'lucide-react';
import { getCustomer, updateCustomer } from '../../services/customersService';
import api from '../../services/api';
import { useT, getT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tabs from '../ui/Tabs';
import Input, { Textarea } from '../ui/Input';
import LoadingSpinner from '../shared/LoadingSpinner';
import { rotuloEstadoReserva } from '../../utils/estadoReserva';
import { useLingua } from '../../utils/formatoLingua';
import { eurosInteiros, formatDate } from '../../pages/reservations/shared';
import { eurosDuasCasas } from '../../utils/formatoEuros';
import { rotuloEtiqueta } from './rotulosClientes';

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="font-body text-n-500 w-24 shrink-0 mt-0.5">{label}</span>
      <span className="font-body text-n-800">{value || '—'}</span>
    </div>
  );
}

const SEGMENT_TAGS = ['VIP', 'grupo', 'corporativo', 'fidelizado', 'novo', 'recorrente'];

export default function CustomerDetail({ customerId, onClose, onUpdate }) {
  const t = useT();
  const lang = useLingua();
  const [customer,      setCustomer]     = useState(null);
  const [loading,       setLoading]      = useState(true);
  const [editingNotes,  setEditNotes]    = useState(false);
  const [notes,         setNotes]        = useState('');
  const [saving,        setSaving]       = useState(false);
  const [activeSection, setSection]      = useState('perfil');

  // Email
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody,    setEmailBody]    = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);

  // Tags
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // Comms history (local — from reservations automations)
  const [commsHistory, setCommsHistory] = useState([]);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    getCustomer(customerId)
      .then(data => {
        setCustomer(data);
        setNotes(data.notes || '');
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await updateCustomer(customerId, { notes });
      setCustomer(c => ({ ...c, notes: updated.notes }));
      onUpdate?.(updated);
      setEditNotes(false);
    } finally { setSaving(false); }
  }

  async function toggleTag(tag) {
    if (!customer) return;
    const current = customer.tags || [];
    const next    = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    setSavingTags(true);
    try {
      const updated = await updateCustomer(customerId, { tags: next });
      setCustomer(c => ({ ...c, tags: next }));
      onUpdate?.(updated);
    } finally { setSavingTags(false); }
  }

  async function addCustomTag() {
    if (!tagInput.trim()) return;
    const current = customer.tags || [];
    if (current.includes(tagInput.trim())) { setTagInput(''); return; }
    const next = [...current, tagInput.trim()];
    setSavingTags(true);
    try {
      const updated = await updateCustomer(customerId, { tags: next });
      setCustomer(c => ({ ...c, tags: next }));
      onUpdate?.(updated);
      setTagInput('');
    } finally { setSavingTags(false); }
  }

  async function handleSendEmail(e) {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    try {
      await api.post(`/customers/${customerId}/email`, {
        subject: emailSubject,
        body: emailBody,
      });
      setEmailSent(true);
      setEmailSubject('');
      setEmailBody('');
      setTimeout(() => setEmailSent(false), 3000);
    } catch (err) {
      console.error(err);
    } finally { setSendingEmail(false); }
  }

  function handleWhatsApp() {
    if (!customer?.whatsapp && !customer?.phone) return;
    const number = (customer.whatsapp || customer.phone).replace(/\D/g, '');
    /* Texto para o cliente: fica sempre em portugues, qualquer que seja a lingua do painel */
    const text   = encodeURIComponent(getT('pt')('customerDetail.messages.greeting', { name: customer.first_name || customer.name?.split(' ')[0] }));
    window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  }

  /* Textos para o cliente: ficam sempre em portugues, qualquer que seja a lingua do painel */
  const tCliente = getT('pt');

  const isVip = (customer?.tags || []).includes('VIP') || Number(customer?.total_spent) > 500;

  const SECTIONS = [
    { key: 'perfil',   label: t('customerDetail.sections.profile') },
    { key: 'tours',    label: t('customerDetail.sections.history') },
    { key: 'comms',    label: t('customerDetail.sections.comms') },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ocean-900/30" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md bg-white shadow-lg flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-n-200 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-base text-n-900">
              {loading ? t('common.loading') : customer?.name}
            </h2>
            {isVip && !loading && (
              <Crown size={14} strokeWidth={1.75} className="text-sand-500" />
            )}
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1 text-n-400 hover:text-n-700 transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size={28} />
          </div>
        ) : customer ? (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-3 border-b border-n-200 shrink-0">
              {[
                { label: t('customers.visits'),         value: customer.total_visits },
                { label: t('customerDetail.ltv'),       value: eurosInteiros(customer.total_spent, lang) },
                { label: t('customersPage.country'),    value: customer.country_code || '—' },
              ].map(m => (
                <div key={m.label} className="px-4 py-4 text-center border-r last:border-r-0 border-n-200">
                  <p className="font-display font-bold text-xl text-ocean-700">{m.value}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 px-4 py-3 border-b border-n-100 shrink-0">
              <Button variant="secondary" size="sm" icon={Mail} onClick={() => setSection('comms')}>{t('customers.email')}</Button>
              <Button variant="secondary" size="sm" icon={MessageCircle} onClick={handleWhatsApp}>WhatsApp</Button>
            </div>

            {/* Section tabs */}
            <div className="px-2 shrink-0">
              <Tabs tabs={SECTIONS.map(s => ({ id: s.key, label: s.label }))} value={activeSection} onChange={setSection} />
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* PERFIL */}
              {activeSection === 'perfil' && (
                <div className="px-5 py-4 space-y-5">
                  <section>
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">{t('customerDetail.contact')}</h3>
                    <div className="space-y-2">
                      <InfoRow label={t('customers.email')} value={customer.email} />
                      <InfoRow label={t('customers.phone')} value={customer.phone} />
                      <InfoRow label="WhatsApp" value={customer.whatsapp} />
                      <InfoRow label={t('customersPage.language')} value={customer.language?.toUpperCase()} />
                      <InfoRow label={t('customerDetail.birthday')} value={customer.birthday ? formatDate(customer.birthday) : null} />
                    </div>
                  </section>

                  {/* Tags */}
                  <section>
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">{t('customers.tags')}</h3>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {SEGMENT_TAGS.map(tag => {
                        const active = (customer.tags || []).includes(tag);
                        return (
                          <button key={tag} onClick={() => toggleTag(tag)} disabled={savingTags}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-xs font-body transition-colors border ${
                              active
                                ? 'bg-ocean-50 border-ocean-300 text-ocean-700'
                                : 'bg-n-50 border-n-200 text-n-500 hover:border-n-400'
                            }`}>
                            {active && <Check size={9} strokeWidth={2.5} />}
                            {rotuloEtiqueta(tag, t, lang)}
                          </button>
                        );
                      })}
                      {(customer.tags || []).filter(t => !SEGMENT_TAGS.includes(t)).map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-sand-50 border border-sand-200 text-sand-600 rounded-xs text-xs font-body">
                          <Tag size={9} strokeWidth={1.75} />{rotuloEtiqueta(tag, t, lang)}
                          <button onClick={() => toggleTag(tag)} disabled={savingTags} className="ml-0.5 hover:text-error"><X size={9} strokeWidth={2} /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                          placeholder={t('customerDetail.newTag')} />
                      </div>
                    </div>
                  </section>

                  {/* Notas */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('customerDetail.internalNotes')}</h3>
                      {!editingNotes && (
                        <button onClick={() => setEditNotes(true)}
                          className="text-xs text-ocean-700 hover:underline flex items-center gap-1">
                          <Pencil size={11} strokeWidth={1.75} /> {t('common.edit')}
                        </button>
                      )}
                    </div>
                    {editingNotes ? (
                      <div className="space-y-2">
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditNotes(false)} className="flex-1">{t('common.cancel')}</Button>
                          <Button size="sm" loading={saving} onClick={saveNotes} className="flex-1">{t('common.save')}</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-body text-n-600 whitespace-pre-line min-h-[2rem]">
                        {customer.notes || <span className="text-n-400 italic">{t('customerDetail.noNotes')}</span>}
                      </p>
                    )}
                  </section>
                </div>
              )}

              {/* HISTORICO */}
              {activeSection === 'tours' && (
                <div className="px-5 py-4">
                  <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">
                    {t('customerDetail.history', { n: customer.reservations?.length || 0 })}
                  </h3>
                  {!customer.reservations?.length ? (
                    <p className="text-sm font-body text-n-400 italic">{t('customerDetail.noBookings')}</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.reservations?.map(r => (
                        <div key={r.id} className="rounded-sm border border-n-200 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-body font-semibold text-n-700 truncate">
                              {r.units?.name || '—'}
                            </p>
                            <Badge variant={r.status}>{rotuloEstadoReserva(r, t)}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-body text-n-500">
                            <span>{formatDate(r.check_in)}</span>
                            <ArrowRight size={10} strokeWidth={1.75} />
                            <span>{formatDate(r.check_out)}</span>
                            <span className="ml-auto font-semibold text-n-700">{eurosDuasCasas(r.total_price || r.total_amount || 0, lang)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* COMUNICACAO */}
              {activeSection === 'comms' && (
                <div className="px-5 py-4 space-y-5">
                  {/* Email form */}
                  <section>
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">{t('customerDetail.sendEmailTitle')}</h3>
                    {emailSent ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--success-light)] border border-n-200 rounded-sm text-sm font-body text-[var(--success)]">
                        <Check size={14} strokeWidth={2} />
                        {t('customerDetail.emailSent')}
                      </div>
                    ) : (
                      <form onSubmit={handleSendEmail} className="space-y-3">
                        <Input label={t('customerDetail.to')} value={customer.email} readOnly />
                        <Input label={t('customerDetail.subject')} value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)} required
                          placeholder={t('customerDetail.subjectPlaceholder')} />
                        <Textarea label={t('customerDetail.message')} value={emailBody}
                          onChange={e => setEmailBody(e.target.value)} required
                          rows={4} placeholder={t('customerDetail.bodyPlaceholder')} />
                        <Button type="submit" loading={sendingEmail} icon={Send} className="w-full">
                          {t('customerDetail.sendEmail')}
                        </Button>
                      </form>
                    )}
                  </section>

                  {/* WhatsApp template */}
                  <section>
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">WhatsApp</h3>
                    {customer.whatsapp || customer.phone ? (
                      <div className="space-y-2">
                        {[
                          { label: t('customerDetail.templates.confirmation'), text: tCliente('customerDetail.messages.confirmation', { name: customer.first_name || customer.name?.split(' ')[0] }) },
                          { label: t('customerDetail.templates.reminder'),     text: tCliente('customerDetail.messages.reminder') },
                          { label: t('customerDetail.templates.review'),       text: tCliente('customerDetail.messages.review') },
                        ].map(({ label, text }) => {
                          const number = (customer.whatsapp || customer.phone || '').replace(/\D/g, '');
                          return (
                            <a key={label}
                              href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-n-200 bg-n-50 hover:border-ocean-300 hover:bg-ocean-50 transition-colors">
                              <MessageCircle size={14} strokeWidth={1.75} className="text-[var(--success)] shrink-0" />
                              <span className="text-sm font-body text-n-700">{label}</span>
                              <ArrowRight size={12} strokeWidth={1.75} className="ml-auto text-n-400" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm font-body text-n-400 italic">{t('customerDetail.noWhatsapp')}</p>
                    )}
                  </section>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
