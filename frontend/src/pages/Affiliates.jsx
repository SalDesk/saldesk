import { useState, useEffect } from 'react';
import {
  UserPlus, Plus, Pencil, Trash2, Copy, Check, Share2,
  Euro, BarChart2, ToggleLeft, ToggleRight, Save,
} from 'lucide-react';
import { getBookingLink } from '../services/marketingService';
import {
  listAffiliates, createAffiliate, updateAffiliate, deleteAffiliate,
  createAffiliatePayment, getAffiliateConfig, updateAffiliateConfig,
} from '../services/affiliatesService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const DEFAULT_CONF = { active: false, commission_pct: 10, min_booking_value: 0 };

/* ── Code generator ── */
function genCode(name) {
  const prefix = (name || 'AFF').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return prefix + suffix;
}

/* ── CopyBtn ── */
function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy}
      className={`flex items-center gap-1 transition-colors font-body font-medium ${small ? 'text-xs px-2 py-1 rounded-xs' : 'text-sm px-3 py-2 rounded-sm'} ${copied ? 'text-[#1A7A4A] bg-[#ECFDF5]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={small ? 10 : 13} strokeWidth={2} /> : <Copy size={small ? 10 : 13} strokeWidth={1.75} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

/* ── AffiliateModal ── */
function AffiliateModal({ affiliate, config, onSave, onClose }) {
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
        ? 'Ja existe um afiliado com este codigo.'
        : 'Erro ao guardar afiliado.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo afiliado' : 'Editar afiliado'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" value={form.name} onChange={set('name')} required placeholder="Ex: Joao Silva" />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required placeholder="joao@exemplo.com" />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Comissao (%)" type="number" min="0" max="50" step="0.5"
            value={form.commission_pct} onChange={set('commission_pct')} required />
          <div>
            <Input label="Codigo de afiliado" value={form.code} onChange={set('code')} required
              className="font-mono uppercase" placeholder="Ex: JOA3K9" />
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? 'Criar afiliado' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── PaymentModal ── */
function PaymentModal({ affiliate, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [note,   setNote]   = useState('Pagamento de comissao');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const totalPaid = Number(affiliate?.commission_paid || 0);
  const pending   = Number(affiliate?.commission_pending || 0);

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { setError('Introduza um montante valido.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(affiliate.id, { amount: Number(amount), payment_date: date, note });
      onClose();
    } catch { setError('Erro ao registar pagamento.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Pagamento — ${affiliate?.name}`} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-2 bg-n-50 border border-n-200 rounded-sm">
            <p className="text-[10px] font-mono text-n-400">TOTAL PAGO</p>
            <p className="font-display font-bold text-sm text-n-700">€{totalPaid.toFixed(2)}</p>
          </div>
          <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-sm">
            <p className="text-[10px] font-mono text-yellow-600">PENDENTE</p>
            <p className="font-display font-bold text-sm text-yellow-700">€{pending.toFixed(2)}</p>
          </div>
        </div>
        <Input label="Montante a pagar (€)" type="number" min="0.01" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)} required />
        <Input label="Data do pagamento" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input label="Nota" value={note} onChange={e => setNote(e.target.value)} />
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button loading={saving} onClick={handleSave} className="flex-1">Registar pagamento</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Affiliates() {
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
    if (!window.confirm('Eliminar este afiliado?')) return;
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
        <PageHeader title="Programa de Afiliados" subtitle="Gere afiliados e comissoes por reservas referenciadas" />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  /* KPIs */
  const totalBookings = affiliates.reduce((s, a) => s + (a.bookings_count || 0), 0);
  const totalPaid     = affiliates.reduce((s, a) => s + Number(a.commission_paid || 0), 0);
  const totalPending  = affiliates.reduce((s, a) => s + Number(a.commission_pending || 0), 0);

  const TABS = [
    { key: 'afiliados',  label: 'Afiliados'      },
    { key: 'config',     label: 'Configuracao'   },
    { key: 'analytics',  label: 'Analytics'      },
  ];

  const topAff = [...affiliates].sort((a, b) => (b.bookings_count || 0) - (a.bookings_count || 0));

  return (
    <div>
      <PageHeader
        title="Programa de Afiliados"
        subtitle="Gere afiliados e comissoes por reservas referenciadas"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={toggleProgramActive}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-body font-semibold transition-colors ${
                config.active ? 'bg-[#ECFDF5] text-[#1A7A4A] border-green-200' : 'bg-n-100 text-n-600 border-n-200'
              }`}>
              {config.active
                ? <ToggleRight size={16} strokeWidth={1.5} />
                : <ToggleLeft  size={16} strokeWidth={1.5} />}
              {config.active ? 'Programa activo' : 'Programa inactivo'}
            </button>
            <Button icon={Plus} onClick={() => setModal({ _new: true })}>Novo afiliado</Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Afiliados activos',   value: affiliates.filter(a => a.active !== false).length, color: 'text-n-900' },
          { label: 'Reservas geradas',    value: totalBookings,                                       color: 'text-ocean-700' },
          { label: 'Comissao paga',       value: `€${totalPaid.toFixed(0)}`,                         color: 'text-[#1A7A4A]' },
          { label: 'Comissao pendente',   value: `€${totalPending.toFixed(0)}`,                      color: 'text-yellow-700' },
        ].map(m => (
          <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3 flex items-center gap-3">
            <UserPlus size={16} strokeWidth={1.75} className="text-n-300 shrink-0" />
            <div>
              <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-5">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'afiliados' && (
        affiliates.length === 0 ? (
          <Card>
            <div className="text-center py-14">
              <UserPlus size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
              <p className="font-display font-semibold text-n-700 mb-1">Sem afiliados registados</p>
              <p className="text-sm font-body text-n-400 mb-4">Cria o primeiro afiliado e partilha o link de afiliado.</p>
              <Button icon={Plus} onClick={() => setModal({ _new: true })}>Novo afiliado</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {affiliates.map(a => {
              const link = affiliateLink(a);
              return (
                <div key={a.id} className={`bg-white border border-n-200 rounded-md px-4 py-4 ${a.active === false ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
                      <span className="font-display font-bold text-xs text-ocean-700">{a.name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-display font-semibold text-sm text-n-900">{a.name}</p>
                          <p className="text-xs font-body text-n-500">{a.email} · <span className="font-mono">{a.code}</span> · {a.commission_pct || 0}% comissao</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setPayModal(a)}
                            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title="Registar pagamento">
                            <Euro size={13} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => handleToggle(a)}
                            className="p-1.5 rounded text-n-400 hover:text-n-700 hover:bg-n-100 transition-colors">
                            {a.active !== false
                              ? <ToggleRight size={13} strokeWidth={1.75} className="text-ocean-700" />
                              : <ToggleLeft size={13} strokeWidth={1.75} />}
                          </button>
                          <button onClick={() => setModal(a)}
                            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                            <Pencil size={13} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => handleDelete(a.id)}
                            className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                            <Trash2 size={13} strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-4 text-center mb-3">
                        {[
                          { label: 'Reservas', value: a.bookings_count || 0, color: 'text-ocean-700' },
                          { label: 'Pago',     value: `€${Number(a.commission_paid || 0).toFixed(0)}`,    color: 'text-[#1A7A4A]' },
                          { label: 'Pendente', value: `€${Number(a.commission_pending || 0).toFixed(0)}`, color: 'text-yellow-700' },
                        ].map(m => (
                          <div key={m.label}>
                            <p className={`font-display font-bold text-sm ${m.color}`}>{m.value}</p>
                            <p className="text-[9px] font-mono text-n-400">{m.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Link */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-n-50 border border-n-200 rounded-xs px-2 py-1 flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-n-600 truncate">{link}</p>
                        </div>
                        <CopyBtn text={link} small />
                        <button
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Reserve o seu tour: ${link}`)}`, '_blank', 'noopener')}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-xs bg-[#25D366] text-white font-body font-medium hover:bg-[#1ebe5a] transition-colors">
                          <Share2 size={10} strokeWidth={1.75} />
                          WA
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'config' && (
        <Card padding="px-6 py-5">
          <h3 className="font-display font-semibold text-sm text-n-700 mb-5">Configuracao global do programa</h3>
          <div className="space-y-4 max-w-sm">
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                Comissao global (%)
              </label>
              <input type="number" min="0" max="50" step="0.5"
                value={config.commission_pct}
                onChange={e => setConfig(p => ({ ...p, commission_pct: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-mono bg-n-100 focus:outline-none focus:border-ocean-700 focus:bg-white"
              />
              <p className="text-xs font-body text-n-400 mt-1">
                Percentagem padrao para novos afiliados. Pode ser sobreposta por afiliado.
              </p>
            </div>

            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                Minimo de reserva (€)
              </label>
              <input type="number" min="0" step="1"
                value={config.min_booking_value}
                onChange={e => setConfig(p => ({ ...p, min_booking_value: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-mono bg-n-100 focus:outline-none focus:border-ocean-700 focus:bg-white"
              />
              <p className="text-xs font-body text-n-400 mt-1">
                Valor minimo da reserva para a comissao ser aplicada. 0 = sem minimo.
              </p>
            </div>

            <Button icon={confSaved ? Check : Save}
              loading={confSaving}
              className={confSaved ? 'bg-[#1A7A4A] hover:bg-[#15623c]' : ''}
              onClick={handleSaveConfig}>
              {confSaved ? 'Guardado' : 'Guardar configuracao'}
            </Button>

            <div className="pt-3 border-t border-n-100">
              <p className="text-xs font-body text-n-400">
                <span className="font-semibold">Portal do afiliado:</span> Cada afiliado pode aceder ao seu dashboard em{' '}
                <span className="font-mono">saldesk.cv/afiliado/[CODIGO]</span> com o email registado.
                As reservas feitas atraves do link (<span className="font-mono">?ref=CODIGO</span>) sao atribuidas
                automaticamente ao afiliado.
              </p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {topAff.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <BarChart2 size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
                <p className="font-body text-n-500">Sem dados de afiliados ainda.</p>
              </div>
            </Card>
          ) : (
            <Card padding="px-5 py-5">
              <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Top afiliados por reservas</h3>
              <div className="space-y-3">
                {topAff.map((a, i) => {
                  const maxBookings = topAff[0]?.bookings_count || 1;
                  const pct = maxBookings > 0 ? ((a.bookings_count || 0) / maxBookings) * 100 : 0;
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
                        i === 0 ? 'bg-sand-300 text-sand-700' : i === 1 ? 'bg-n-200 text-n-600' : 'bg-n-100 text-n-500'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-body font-semibold text-n-800 truncate">{a.name}</p>
                          <span className="text-xs font-mono text-n-600 shrink-0 ml-2">
                            {a.bookings_count || 0} reservas · €{Number(a.commission_paid || 0).toFixed(0)} pago
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
            </Card>
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
