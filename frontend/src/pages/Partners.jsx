import { useState } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Handshake, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  Hotel, Car, Utensils, Compass, ToggleLeft, ToggleRight,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';

const STORAGE_KEY = 'saldesk_partners_v1';
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function persist(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }

const PARTNER_TYPES = [
  { value: 'hotel',      label: 'Hotel / Alojamento', Icon: Hotel   },
  { value: 'activity',   label: 'Actividade Turistica', Icon: Compass },
  { value: 'rentacar',   label: 'Rent-a-Car',         Icon: Car     },
  { value: 'restaurant', label: 'Restaurante',        Icon: Utensils },
];

const PARTNERSHIP_TYPES = [
  { value: 'recommendation', label: 'Recomendacao mutua (sem comissao)' },
  { value: 'commission',     label: 'Comissao por reserva referenciada'  },
  { value: 'discount',       label: 'Desconto cruzado para clientes'     },
];

/* ── PartnerModal ── */
function PartnerModal({ partner, onSave, onClose }) {
  const isNew = !partner || partner._new;
  const base  = isNew ? null : partner;

  const [form, setForm] = useState({
    name:               base?.name               || '',
    partner_type:       base?.partner_type       || 'hotel',
    partnership_type:   base?.partnership_type   || 'recommendation',
    commission_pct:     base?.commission_pct     || '',
    message_pt:         base?.message_pt         || '',
    message_en:         base?.message_en         || '',
    bookings_sent:      base?.bookings_sent      || 0,
    bookings_received:  base?.bookings_received  || 0,
    active:             base?.active             ?? true,
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...base,
      ...form,
      commission_pct: form.commission_pct ? Number(form.commission_pct) : 0,
      id: base?.id || Date.now().toString(),
      created_at: base?.created_at || new Date().toISOString(),
    });
  }

  const needsCommission = form.partnership_type === 'commission';
  const needsMessage    = form.partnership_type !== 'discount';

  return (
    <Modal open onClose={onClose} title={isNew ? 'Adicionar parceiro' : 'Editar parceiro'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome do parceiro" value={form.name} onChange={set('name')} required placeholder="Ex: Hotel Morabeza" />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de parceiro" value={form.partner_type} onChange={set('partner_type')}>
            {PARTNER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select label="Tipo de parceria" value={form.partnership_type} onChange={set('partnership_type')}>
            {PARTNERSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>

        {needsCommission && (
          <Input
            label="Comissao (%)"
            type="number" min="0" max="50" step="0.5"
            value={form.commission_pct} onChange={set('commission_pct')}
            placeholder="Ex: 10"
            hint="Percentagem da reserva paga ao parceiro que a referenciou"
          />
        )}

        {needsMessage && (
          <>
            <Textarea label="Mensagem de recomendacao PT" value={form.message_pt} onChange={set('message_pt')} rows={3}
              placeholder="Ex: Para o seu alojamento em Sal, recomendamos o nosso parceiro Hotel Morabeza." />
            <Textarea label="Mensagem de recomendacao EN" value={form.message_en} onChange={set('message_en')} rows={3}
              placeholder="Ex: For your accommodation in Sal, we recommend our partner Hotel Morabeza." />
          </>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Adicionar' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── BookingLogModal ── */
function BookingLogModal({ partner, onSave, onClose }) {
  const [direction, setDirection] = useState('sent');
  const [count,     setCount]     = useState('1');

  function handleSave() {
    const delta = Number(count) || 1;
    onSave(partner.id, direction, delta);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Registar reservas — ${partner.name}`} size="sm">
      <div className="space-y-4">
        <div className="flex gap-1 bg-n-100 rounded-sm p-0.5">
          {[{ v: 'sent', l: 'Reserva enviada ao parceiro' }, { v: 'received', l: 'Reserva recebida do parceiro' }].map(o => (
            <button key={o.v} onClick={() => setDirection(o.v)}
              className={`flex-1 py-1.5 text-xs font-body font-semibold rounded-xs transition-colors ${direction === o.v ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <Input label="Numero de reservas" type="number" min="1" step="1" value={count} onChange={e => setCount(e.target.value)} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} className="flex-1">Registar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Partners() {
  const [partners,  setPartners]  = useState(load);
  const [modal,     setModal]     = useState(null);
  const [logModal,  setLogModal]  = useState(null);
  const [activeTab, setActiveTab] = useState('parceiros');

  function handleSave(p) {
    setPartners(prev => {
      const next = prev.find(x => x.id === p.id)
        ? prev.map(x => x.id === p.id ? p : x)
        : [...prev, p];
      persist(next);
      return next;
    });
    setModal(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Eliminar este parceiro?')) return;
    setPartners(prev => { const next = prev.filter(p => p.id !== id); persist(next); return next; });
  }

  function handleToggle(id) {
    setPartners(prev => {
      const next = prev.map(p => p.id === id ? { ...p, active: !p.active } : p);
      persist(next); return next;
    });
  }

  function handleLogBooking(partnerId, direction, delta) {
    setPartners(prev => {
      const next = prev.map(p => {
        if (p.id !== partnerId) return p;
        return direction === 'sent'
          ? { ...p, bookings_sent: (p.bookings_sent || 0) + delta }
          : { ...p, bookings_received: (p.bookings_received || 0) + delta };
      });
      persist(next); return next;
    });
  }

  /* Dashboard stats */
  const totalSent      = partners.reduce((s, p) => s + (p.bookings_sent || 0), 0);
  const totalReceived  = partners.reduce((s, p) => s + (p.bookings_received || 0), 0);
  const commPayable    = partners
    .filter(p => p.partnership_type === 'commission' && p.commission_pct > 0)
    .reduce((s, p) => s + (p.bookings_sent || 0) * (p.avg_booking_value || 0) * (p.commission_pct / 100), 0);
  const commReceivable = partners
    .filter(p => p.partnership_type === 'commission' && p.commission_pct > 0)
    .reduce((s, p) => s + (p.bookings_received || 0) * (p.avg_booking_value || 0) * (p.commission_pct / 100), 0);

  const TABS = [
    { key: 'parceiros',  label: 'Parceiros'          },
    { key: 'dashboard',  label: 'Dashboard'          },
  ];

  return (
    <div>
      <PageHeader
        title="Parcerias Cross-Selling"
        subtitle="Recomendacoes e comissoes entre operadores SalDesk"
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>Adicionar parceiro</Button>
        }
      />

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

      {activeTab === 'parceiros' && (
        partners.length === 0 ? (
          <Card>
            <div className="text-center py-14">
              <Handshake size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
              <p className="font-display font-semibold text-n-700 mb-1">Sem parceiros configurados</p>
              <p className="text-sm font-body text-n-400 mb-4">
                Adiciona operadores SalDesk parceiros para comecar a fazer cross-selling.
              </p>
              <Button icon={Plus} onClick={() => setModal({ _new: true })}>Adicionar parceiro</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {partners.map(p => {
              const typeInfo = PARTNER_TYPES.find(t => t.value === p.partner_type) || PARTNER_TYPES[0];
              const pshipType = PARTNERSHIP_TYPES.find(t => t.value === p.partnership_type) || PARTNERSHIP_TYPES[0];
              return (
                <div key={p.id} className={`bg-white border border-n-200 rounded-md px-4 py-4 flex items-start gap-4 ${!p.active ? 'opacity-60' : ''}`}>
                  <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                    <typeInfo.Icon size={18} strokeWidth={1.75} className="text-ocean-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-semibold text-sm text-n-900">{p.name}</p>
                        <p className="text-xs font-body text-n-500 mt-0.5">{typeInfo.label} · {pshipType.label}</p>
                        {p.commission_pct > 0 && (
                          <p className="text-xs font-mono text-n-400 mt-0.5">{p.commission_pct}% comissao</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-center">
                        <div>
                          <p className="font-display font-bold text-sm text-ocean-700">{p.bookings_sent || 0}</p>
                          <p className="text-[9px] font-mono text-n-400">enviadas</p>
                        </div>
                        <div>
                          <p className="font-display font-bold text-sm text-[#1A7A4A]">{p.bookings_received || 0}</p>
                          <p className="text-[9px] font-mono text-n-400">recebidas</p>
                        </div>
                      </div>
                    </div>
                    {p.message_pt && (
                      <p className="text-xs font-body text-n-500 mt-2 line-clamp-1">{p.message_pt}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setLogModal(p)}
                      className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title="Registar reservas">
                      <Handshake size={13} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => handleToggle(p.id)}
                      className="p-1.5 rounded text-n-400 hover:text-n-700 hover:bg-n-100 transition-colors">
                      {p.active
                        ? <ToggleRight size={13} strokeWidth={1.75} className="text-ocean-700" />
                        : <ToggleLeft size={13} strokeWidth={1.75} />}
                    </button>
                    <button onClick={() => setModal(p)}
                      className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors">
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Parceiros activos',     value: partners.filter(p => p.active).length, color: 'text-n-900' },
              { label: 'Reservas enviadas',      value: totalSent,                             color: 'text-ocean-700', Icon: ArrowUpRight },
              { label: 'Reservas recebidas',     value: totalReceived,                         color: 'text-[#1A7A4A]', Icon: ArrowDownRight },
              { label: 'Balanco (recebidas - enviadas)', value: totalReceived - totalSent,     color: (totalReceived - totalSent) >= 0 ? 'text-[#1A7A4A]' : 'text-error' },
            ].map(m => (
              <div key={m.label} className="bg-white border border-n-200 rounded-md px-4 py-3">
                <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                <p className="text-xs font-body text-n-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {partners.some(p => p.partnership_type === 'commission') && (
            <div className="grid grid-cols-2 gap-4">
              <Card padding="px-5 py-4">
                <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Comissoes a pagar</h3>
                <p className="font-display font-bold text-2xl text-error">€{commPayable.toFixed(0)}</p>
                <p className="text-xs font-body text-n-400 mt-0.5">
                  Por reservas que enviaste aos parceiros com comissao.
                  <br />Requer precos medios configurados por parceiro.
                </p>
              </Card>
              <Card padding="px-5 py-4">
                <h3 className="font-display font-semibold text-sm text-n-700 mb-3">Comissoes a receber</h3>
                <p className="font-display font-bold text-2xl text-[#1A7A4A]">€{commReceivable.toFixed(0)}</p>
                <p className="text-xs font-body text-n-400 mt-0.5">
                  Por reservas que os parceiros te enviaram.
                  <br />Requer precos medios configurados por parceiro.
                </p>
              </Card>
            </div>
          )}

          <div className="px-4 py-3 bg-ocean-50 border border-ocean-100 rounded-sm">
            <p className="text-xs font-body text-ocean-700">
              <span className="font-semibold">Nota:</span> Para activar as recomendacoes automaticas (email apos tour confirmado, etc.), configura as automacoes correspondentes em <span className="font-mono">Automacoes de Comunicacao</span>.
            </p>
          </div>
        </div>
      )}

      {modal && (
        <PartnerModal partner={modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {logModal && (
        <BookingLogModal partner={logModal} onSave={handleLogBooking} onClose={() => setLogModal(null)} />
      )}
    </div>
  );
}
