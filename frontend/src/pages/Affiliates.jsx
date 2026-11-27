import { useState, useEffect } from 'react';
import {
  UserPlus, Plus, Pencil, Trash2, Copy, Check, Share2,
  Euro, BarChart2, ToggleLeft, ToggleRight, Save, Clock,
} from 'lucide-react';
import { getBookingLink } from '../services/marketingService';
import {
  listAffiliates, createAffiliate, updateAffiliate, deleteAffiliate,
  createAffiliatePayment, getAffiliateConfig, updateAffiliateConfig,
} from '../services/affiliatesService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Tabs from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MareStat from '../components/shared/MareStat';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';
import { getT, useT } from '../i18n';
import { useLingua } from '../utils/formatoLingua';
import { eurosDuasCasas } from '../utils/formatoEuros';
import { eurosInteiros } from './reservations/shared';

const DEFAULT_CONF = { active: false, commission_pct: 10, min_booking_value: 0 };

/* ── Estilo Mare: cartao de pagina, titulo de cartao e figuras (codigos, comissoes, valores) ── */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const CARTAO_VAZIO = 'bg-white rounded-[18px] border border-mare-card min-w-0 overflow-hidden';
const TITULO = 'font-display text-[18px] font-semibold text-ocean-900';
const NUM = 'font-mono tabular-nums';
const ACAO_PEQUENA = 'flex items-center gap-1.5 text-xs px-2 py-1 min-h-11 md:min-h-8 rounded-xs font-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';

/* ── Code generator ── */
function genCode(name) {
  const prefix = (name || 'AFF').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return prefix + suffix;
}

/* ── CopyBtn ── */
function CopyBtn({ text }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy}
      className={`${ACAO_PEQUENA} ${copied ? 'text-[var(--success)] bg-[var(--success-light)]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.75} />}
      {copied ? t('affiliatesPage.copied') : t('affiliatesPage.copy')}
    </button>
  );
}

/* ── AffiliateModal ── */
function AffiliateModal({ affiliate, config, onSave, onClose }) {
  const t = useT();
  const isNew = !affiliate || affiliate._new;
  const base  = isNew ? null : affiliate;

  const [form, setForm] = useState({
    name:           base?.name           || '',
    email:          base?.email          || '',
    commission_pct: base?.commission_pct ?? config?.commission_pct ?? 10,
    code:           base?.code           || '',
    active:         base?.active         ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  useEffect(() => {
    if (isNew && form.name && !form.code) {
      setForm(p => ({ ...p, code: genCode(form.name) }));
    }
  }, [form.name]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(base?.id, {
        name: form.name,
        email: form.email,
        commission_pct: Number(form.commission_pct),
        code: form.code.trim().toUpperCase(),
        active: form.active,
      });
    } catch (err) {
      setError(err.response?.data?.code === 'DUPLICATE_CODE'
        ? t('affiliatesPage.modal.duplicateCode')
        : t('affiliatesPage.modal.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('affiliatesPage.modal.newTitle') : t('affiliatesPage.modal.editTitle')} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('affiliatesPage.modal.name')} aria-label={t('affiliatesPage.modal.name')} value={form.name} onChange={set('name')} required placeholder={t('affiliatesPage.modal.namePlaceholder')} />
        <Input label={t('affiliatesPage.modal.email')} aria-label={t('affiliatesPage.modal.email')} type="email" value={form.email} onChange={set('email')} required placeholder={t('affiliatesPage.modal.emailPlaceholder')} />

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('affiliatesPage.modal.commission')} aria-label={t('affiliatesPage.modal.commission')} type="number" min="0" max="50" step="0.5"
            value={form.commission_pct} onChange={set('commission_pct')} required />
          <div>
            <Input label={t('affiliatesPage.modal.code')} aria-label={t('affiliatesPage.modal.code')} value={form.code} onChange={set('code')} required
              className="font-mono uppercase" placeholder={t('affiliatesPage.modal.codePlaceholder')} />
          </div>
        </div>

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? t('affiliatesPage.modal.create') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── PaymentModal ── */
function PaymentModal({ affiliate, onSave, onClose }) {
  const t = useT();
  const lang = useLingua();
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [note,   setNote]   = useState(() => getT('pt')('affiliatesPage.payment.defaultNote'));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const totalPaid = Number(affiliate?.commission_paid || 0);
  const pending   = Number(affiliate?.commission_pending || 0);

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { setError(t('affiliatesPage.payment.invalidAmount')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(affiliate.id, { amount: Number(amount), payment_date: date, note });
      onClose();
    } catch { setError(t('affiliatesPage.payment.saveError')); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('affiliatesPage.payment.title', { name: affiliate?.name })} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm">
            <p className="text-[10px] font-mono text-n-600">{t('affiliatesPage.payment.totalPaid')}</p>
            <p className={`${NUM} font-bold text-sm text-n-700`}>{eurosDuasCasas(totalPaid, lang)}</p>
          </div>
          <div className="px-3 py-2 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm">
            <p className="text-[10px] font-mono text-[var(--warning)]">{t('affiliatesPage.payment.pending')}</p>
            <p className={`${NUM} font-bold text-sm text-[var(--warning)]`}>{eurosDuasCasas(pending, lang)}</p>
          </div>
        </div>
        <Input label={t('affiliatesPage.payment.amount')} aria-label={t('affiliatesPage.payment.amount')} type="number" min="0.01" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)} required />
        <Input label={t('affiliatesPage.payment.date')} aria-label={t('affiliatesPage.payment.date')} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input label={t('affiliatesPage.payment.note')} aria-label={t('affiliatesPage.payment.note')} value={note} onChange={e => setNote(e.target.value)} />
        {error && <p className="text-xs text-[var(--error)]">{error}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button loading={saving} onClick={handleSave} className="flex-1">{t('affiliatesPage.payment.register')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Affiliates() {
  const t = useT();
  const lang = useLingua();
  const { operator } = useAuthStore();
  const [affiliates, setAffiliates] = useState([]);
  const [config,     setConfig]     = useState(DEFAULT_CONF);
  const [loading,    setLoading]    = useState(true);
  const [slug,       setSlug]       = useState('');
  const [modal,      setModal]      = useState(null);
  const [payModal,   setPayModal]   = useState(null);
  const [activeTab,  setActiveTab]  = useState('afiliados');
  const [confSaving, setConfSaving] = useState(false);
  const [confSaved,  setConfSaved]  = useState(false);

  async function reload() {
    const data = await listAffiliates().catch(() => []);
    setAffiliates(data || []);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listAffiliates().catch(() => []),
      getAffiliateConfig().catch(() => DEFAULT_CONF),
    ]).then(([affs, conf]) => {
      setAffiliates(affs || []);
      setConfig({ ...DEFAULT_CONF, ...conf });
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (operator?.slug) {
      setSlug(operator.slug);
    } else {
      getBookingLink()
        .then(d => {
          const url = d?.url || d || '';
          const match = url.match(/book\/([^?/]+)/);
          if (match) setSlug(match[1]);
        })
        .catch(() => {});
    }
  }, [operator]);

  function affiliateLink(a) {
    return `https://saldesk.cv/book/${slug}?ref=${a.code}`;
  }

  async function handleSaveAff(id, dados) {
    if (id) await updateAffiliate(id, dados);
    else await createAffiliate(dados);
    await reload();
    setModal(null);
  }

  async function handleDelete(id) {
    if (!window.confirm(t('affiliatesPage.confirmDelete'))) return;
    await deleteAffiliate(id);
    setAffiliates(prev => prev.filter(a => a.id !== id));
  }

  async function handleToggle(a) {
    const updated = await updateAffiliate(a.id, { active: !a.active });
    setAffiliates(prev => prev.map(x => x.id === a.id ? updated : x));
  }

  async function handlePayment(affId, payment) {
    await createAffiliatePayment(affId, payment);
    await reload();
  }

  async function handleSaveConfig() {
    setConfSaving(true);
    try {
      await updateAffiliateConfig(config);
      setConfSaved(true);
      setTimeout(() => setConfSaved(false), 2000);
    } finally { setConfSaving(false); }
  }

  async function toggleProgramActive() {
    const next = { ...config, active: !config.active };
    setConfig(next);
    await updateAffiliateConfig(next).catch(() => setConfig(config));
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow={t('nav.sections.crescimento')} title={t('affiliatesPage.title')} subtitle={t('affiliatesPage.subtitle')} />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  /* KPIs */
  const totalBookings = affiliates.reduce((s, a) => s + (a.bookings_count || 0), 0);
  const totalPaid     = affiliates.reduce((s, a) => s + Number(a.commission_paid || 0), 0);
  const totalPending  = affiliates.reduce((s, a) => s + Number(a.commission_pending || 0), 0);

  const TABS = [
    { id: 'afiliados',  label: t('affiliatesPage.tabs.affiliates') },
    { id: 'config',     label: t('affiliatesPage.tabs.config') },
    { id: 'analytics',  label: t('affiliatesPage.tabs.analytics') },
  ];

  const topAff = [...affiliates].sort((a, b) => (b.bookings_count || 0) - (a.bookings_count || 0));

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.crescimento')}
        title={t('affiliatesPage.title')}
        subtitle={t('affiliatesPage.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={toggleProgramActive} aria-pressed={!!config.active}
              className={`flex items-center gap-2 px-3 py-1.5 min-h-11 md:min-h-9 rounded-sm border text-xs font-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${
                config.active ? 'bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]' : 'bg-n-100 text-n-600 border-n-200'
              }`}>
              {config.active
                ? <ToggleRight size={16} strokeWidth={1.5} />
                : <ToggleLeft  size={16} strokeWidth={1.5} />}
              {config.active ? t('affiliatesPage.programActive') : t('affiliatesPage.programInactive')}
            </button>
            <Button icon={Plus} className="min-h-11 md:min-h-0" onClick={() => setModal({ _new: true })}>{t('affiliatesPage.newAffiliate')}</Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MareStat label={t('affiliatesPage.kpi.active')} value={affiliates.filter(a => a.active !== false).length} icon={UserPlus} />
        <MareStat label={t('affiliatesPage.kpi.bookings')} value={totalBookings} icon={BarChart2} />
        <MareStat label={t('affiliatesPage.kpi.paid')} value={eurosInteiros(totalPaid, lang)} icon={Euro} tone="bom" />
        <MareStat label={t('affiliatesPage.kpi.pending')} value={eurosInteiros(totalPending, lang)} icon={Clock} tone="aviso" />
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'afiliados' && (
        affiliates.length === 0 ? (
          <section className={CARTAO_VAZIO}>
            <EmptyState icon={UserPlus} title={t('affiliatesPage.empty.title')}
              description={t('affiliatesPage.empty.description')}
              action={<Button icon={Plus} className="min-h-11 md:min-h-0" onClick={() => setModal({ _new: true })}>{t('affiliatesPage.newAffiliate')}</Button>} />
          </section>
        ) : (
          <div className="space-y-3">
            {affiliates.map(a => {
              const link = affiliateLink(a);
              return (
                <article key={a.id} className={`${CARTAO} ${a.active === false ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
                      <span className="font-display font-bold text-xs text-ocean-700">{a.name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-2">
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-base text-ocean-900 break-words">{a.name}</p>
                          <p className="text-xs font-body text-n-600 break-words">{a.email} · <span className={NUM}>{a.code}</span> · <span className={NUM}>{t('affiliatesPage.row.commission', { pct: a.commission_pct || 0 })}</span></p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <IconBtn icon={Euro} label={t('affiliatesPage.row.registerPaymentFor', { name: a.name })} title={t('affiliatesPage.row.registerPayment')}
                            onClick={() => setPayModal(a)} hover={EDIT_HOVER} />
                          <IconBtn icon={a.active !== false ? ToggleRight : ToggleLeft}
                            label={t(a.active !== false ? 'affiliatesPage.row.deactivate' : 'affiliatesPage.row.activate', { name: a.name })}
                            onClick={() => handleToggle(a)} hover="hover:text-n-800 hover:bg-n-100"
                            className={a.active !== false ? 'text-ocean-700' : ''} />
                          <IconBtn icon={Pencil} label={t('affiliatesPage.row.edit', { name: a.name })}
                            onClick={() => setModal(a)} hover={EDIT_HOVER} />
                          <IconBtn icon={Trash2} label={t('affiliatesPage.row.delete', { name: a.name })}
                            onClick={() => handleDelete(a.id)} hover={DELETE_HOVER} />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-center mb-3">
                        {[
                          { label: t('affiliatesPage.row.bookings'), value: a.bookings_count || 0, color: 'text-ocean-900' },
                          { label: t('affiliatesPage.row.paid'),     value: eurosInteiros(a.commission_paid, lang),    color: 'text-ocean-900' },
                          { label: t('affiliatesPage.row.pending'), value: eurosInteiros(a.commission_pending, lang), color: 'text-ocean-900' },
                        ].map(m => (
                          <div key={m.label}>
                            <p className={`${NUM} font-bold text-sm ${m.color}`}>{m.value}</p>
                            <p className="text-[11px] font-body text-n-600">{m.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Link */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-mare-head border border-mare-card rounded-[10px] px-2.5 py-1.5 flex-1 min-w-0">
                          <p className={`${NUM} text-[11px] text-n-600 break-all`}>{link}</p>
                        </div>
                        <CopyBtn text={link} />
                        <button
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(getT('pt')('affiliatesPage.shareText', { link }))}`, '_blank', 'noopener')}
                          className={`${ACAO_PEQUENA} bg-[var(--success)] text-white hover:opacity-90`}>
                          <Share2 size={11} strokeWidth={1.75} />
                          WA
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'config' && (
        <section className={CARTAO}>
          <h2 className={`${TITULO} mb-5`}>{t('affiliatesPage.config.title')}</h2>
          <div className="space-y-4 max-w-sm">
            <Input label={t('affiliatesPage.config.globalCommission')} aria-label={t('affiliatesPage.config.globalCommission')} type="number" min="0" max="50" step="0.5"
              value={config.commission_pct}
              onChange={e => setConfig(p => ({ ...p, commission_pct: Number(e.target.value) }))}
              className="font-mono"
              hint={t('affiliatesPage.config.globalCommissionHint')}
            />

            <Input label={t('affiliatesPage.config.minBooking')} aria-label={t('affiliatesPage.config.minBooking')} type="number" min="0" step="1"
              value={config.min_booking_value}
              onChange={e => setConfig(p => ({ ...p, min_booking_value: Number(e.target.value) }))}
              className="font-mono"
              hint={t('affiliatesPage.config.minBookingHint')}
            />

            <Button icon={confSaved ? Check : Save}
              loading={confSaving}
              className={`min-h-11 md:min-h-0 ${confSaved ? '!bg-[var(--success)] !text-white hover:!opacity-90' : ''}`}
              onClick={handleSaveConfig}>
              {confSaved ? t('affiliatesPage.config.saved') : t('affiliatesPage.config.save')}
            </Button>

            <div className="bg-mare-head rounded-[14px] p-3">
              <p className="text-xs font-body text-n-600">
                <span className="font-semibold">{t('affiliatesPage.config.portalLabel')}</span> {t('affiliatesPage.config.portalIntro')}{' '}
                <span className={`${NUM} break-all`}>saldesk.cv/afiliado/[CODIGO]</span> {t('affiliatesPage.config.portalMid')}<span className={NUM}>?ref=CODIGO</span>{t('affiliatesPage.config.portalEnd')}
              </p>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {topAff.length === 0 ? (
            <section className={CARTAO_VAZIO}>
              <EmptyState icon={BarChart2} title={t('affiliatesPage.analytics.empty')} />
            </section>
          ) : (
            <section className={CARTAO}>
              <h2 className={`${TITULO} mb-4`}>{t('affiliatesPage.analytics.top')}</h2>
              <div className="space-y-3">
                {topAff.map((a, i) => {
                  const maxBookings = topAff[0]?.bookings_count || 1;
                  const pct = maxBookings > 0 ? ((a.bookings_count || 0) / maxBookings) * 100 : 0;
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
                        i === 0 ? 'bg-[var(--sand-300)] text-[var(--sand-600)]' : i === 1 ? 'bg-n-200 text-n-600' : 'bg-n-100 text-n-500'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-body font-semibold text-n-800 truncate">{a.name}</p>
                          <span className={`text-xs ${NUM} text-n-600 shrink-0 ml-2`}>
                            {t('affiliatesPage.analytics.line', { n: a.bookings_count || 0, paid: eurosInteiros(a.commission_paid, lang) })}
                          </span>
                        </div>
                        <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
                          <div className="h-full bg-ocean-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {modal && (
        <AffiliateModal
          affiliate={modal}
          config={config}
          onSave={handleSaveAff}
          onClose={() => setModal(null)}
        />
      )}
      {payModal && (
        <PaymentModal
          affiliate={payModal}
          onSave={handlePayment}
          onClose={() => setPayModal(null)}
        />
      )}
    </div>
  );
}
