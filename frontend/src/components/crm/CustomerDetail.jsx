import { useState, useEffect } from 'react';
import {
  X, ArrowRight, Pencil, Check, Tag, Mail, MessageCircle,
  Phone, Globe, Calendar, Crown, Send, Clock, ChevronDown, Plus,
} from 'lucide-react';
import { getCustomer, updateCustomer } from '../../services/customersService';
import api from '../../services/api';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import LoadingSpinner from '../shared/LoadingSpinner';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

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
    const text   = encodeURIComponent(`Ola ${customer.first_name || customer.name?.split(' ')[0]}, obrigado pela sua preferencia!`);
    window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  }

  const isVip = (customer?.tags || []).includes('VIP') || Number(customer?.total_spent) > 500;

  const SECTIONS = [
    { key: 'perfil',   label: 'Perfil' },
    { key: 'tours',    label: 'Historico' },
    { key: 'comms',    label: 'Comunicacao' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ocean-900/30" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md bg-white shadow-lg flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-n-200 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-base text-n-900">
              {loading ? 'A carregar...' : customer?.name}
            </h2>
            {isVip && !loading && (
              <Crown size={14} strokeWidth={1.75} className="text-sand-500" />
            )}
          </div>
          <button onClick={onClose} className="p-1 text-n-400 hover:text-n-700 transition-colors">
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
                { label: 'Visitas',     value: customer.total_visits },
                { label: 'LTV',         value: `€${Number(customer.total_spent).toFixed(0)}` },
                { label: 'Pais',        value: customer.country_code || '—' },
              ].map(m => (
                <div key={m.label} className="px-4 py-4 text-center border-r last:border-r-0 border-n-200">
                  <p className="font-display font-bold text-xl text-ocean-700">{m.value}</p>
                  <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 px-4 py-3 border-b border-n-100 shrink-0">
              <button onClick={() => setSection('comms')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-n-200 bg-n-50 text-xs font-body text-n-700 hover:border-ocean-300 hover:bg-ocean-50 transition-colors">
                <Mail size={12} strokeWidth={1.75} />
                Email
              </button>
              <button onClick={handleWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-n-200 bg-n-50 text-xs font-body text-n-700 hover:border-green-400 hover:bg-green-50 transition-colors">
                <MessageCircle size={12} strokeWidth={1.75} />
                WhatsApp
              </button>
            </div>

            {/* Section tabs */}
            <div className="flex border-b border-n-200 shrink-0">
              {SECTIONS.map(s => (
                <button key={s.key} onClick={() => setSection(s.key)}
                  className={`flex-1 px-3 py-2.5 text-xs font-body font-semibold transition-colors ${
                    activeSection === s.key ? 'border-b-2 border-ocean-700 text-ocean-700' : 'text-n-500 hover:text-n-700'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* PERFIL */}
              {activeSection === 'perfil' && (
                <div className="px-5 py-4 space-y-5">
                  <section>
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">Contacto</h3>
                    <div className="space-y-2">
                      <InfoRow label="Email"    value={customer.email} />
                      <InfoRow label="Telefone" value={customer.phone} />
                      <InfoRow label="WhatsApp" value={customer.whatsapp} />
                      <InfoRow label="Idioma"   value={customer.language?.toUpperCase()} />
                      <InfoRow label="Aniversario" value={customer.birthday ? formatDate(customer.birthday) : null} />
                    </div>
                  </section>

                  {/* Tags */}
                  <section>
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">Tags</h3>
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
                            {tag}
                          </button>
                        );
                      })}
                      {(customer.tags || []).filter(t => !SEGMENT_TAGS.includes(t)).map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-sand-50 border border-sand-200 text-sand-600 rounded-xs text-xs font-body">
                          <Tag size={9} strokeWidth={1.75} />{tag}
                          <button onClick={() => toggleTag(tag)} disabled={savingTags} className="ml-0.5 hover:text-error"><X size={9} strokeWidth={2} /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                        placeholder="Nova tag + Enter"
                        className="flex-1 h-8 px-3 rounded-sm border border-n-200 text-xs font-body bg-n-50 placeholder:text-n-400 focus:outline-none focus:border-ocean-700 focus:bg-white" />
                    </div>
                  </section>

                  {/* Notas */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Notas internas</h3>
                      {!editingNotes && (
                        <button onClick={() => setEditNotes(true)}
                          className="text-xs text-ocean-700 hover:underline flex items-center gap-1">
                          <Pencil size={11} strokeWidth={1.75} /> Editar
                        </button>
                      )}
                    </div>
                    {editingNotes ? (
                      <div className="space-y-2">
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditNotes(false)} className="flex-1">Cancelar</Button>
                          <Button size="sm" loading={saving} onClick={saveNotes} className="flex-1">Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-body text-n-600 whitespace-pre-line min-h-[2rem]">
                        {customer.notes || <span className="text-n-400 italic">Sem notas</span>}
                      </p>
                    )}
                  </section>
                </div>
              )}

              {/* HISTORICO */}
              {activeSection === 'tours' && (
                <div className="px-5 py-4">
                  <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">
                    Historico ({customer.reservations?.length || 0})
                  </h3>
                  {!customer.reservations?.length ? (
                    <p className="text-sm font-body text-n-400 italic">Sem reservas</p>
                  ) : (
                    <div className="space-y-2">
                      {customer.reservations?.map(r => (
                        <div key={r.id} className="rounded-sm border border-n-200 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-body font-semibold text-n-700 truncate">
                              {r.units?.name || '—'}
                            </p>
                            <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-body text-n-500">
                            <span>{formatDate(r.check_in)}</span>
                            <ArrowRight size={10} strokeWidth={1.75} />
                            <span>{formatDate(r.check_out)}</span>
                            <span className="ml-auto font-semibold text-n-700">€{Number(r.total_price || r.total_amount || 0).toFixed(2)}</span>
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
                    <h3 className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-3">Enviar Email</h3>
                    {emailSent ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#ECFDF5] border border-green-200 rounded-sm text-sm font-body text-[#1A7A4A]">
                        <Check size={14} strokeWidth={2} />
                        Email enviado com sucesso
                      </div>
                    ) : (
                      <form onSubmit={handleSendEmail} className="space-y-3">
                        <Input label="Para" value={customer.email} readOnly />
                        <Input label="Assunto" value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)} required
                          placeholder="Assunto do email" />
                        <Textarea label="Mensagem" value={emailBody}
                          onChange={e => setEmailBody(e.target.value)} required
                          rows={4} placeholder="Corpo do email..." />
                        <Button type="submit" loading={sendingEmail} icon={Send} className="w-full">
                          Enviar email
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
                          { label: 'Confirmacao de reserva', text: `Ola ${customer.first_name || customer.name?.split(' ')[0]}! A sua reserva foi confirmada. Aguardamos a sua visita!` },
                          { label: 'Lembrete de tour',       text: `Ola! Lembrete do seu tour amanha. Nao se esqueca de trazer protector solar e agua.` },
                          { label: 'Pedido de avaliacao',    text: `Obrigado pela sua visita! Pode deixar a sua avaliacao em: https://app.saldesk.cv` },
                        ].map(({ label, text }) => {
                          const number = (customer.whatsapp || customer.phone || '').replace(/\D/g, '');
                          return (
                            <a key={label}
                              href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-n-200 bg-n-50 hover:border-green-400 hover:bg-green-50 transition-colors">
                              <MessageCircle size={14} strokeWidth={1.75} className="text-[#25D366] shrink-0" />
                              <span className="text-sm font-body text-n-700">{label}</span>
                              <ArrowRight size={12} strokeWidth={1.75} className="ml-auto text-n-400" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm font-body text-n-400 italic">Sem numero WhatsApp registado</p>
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
