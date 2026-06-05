import { useState, useEffect, useCallback } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Tag, Plus, Copy, Check, Share2, Pencil, Trash2,
  Mail, Calendar, AlertTriangle, BarChart2, Gift,
  RefreshCw,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import { getBookingLink } from '../services/marketingService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input, { Select } from '../components/ui/Input';

/* ── localStorage ── */
const STORAGE_KEY = 'saldesk_vouchers_v1';

function loadVouchers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveVouchers(v) { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }

/* ── Helpers ── */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function voucherStatus(v) {
  if (!v.active) return 'inactivo';
  if (v.expires_at && new Date(v.expires_at) < new Date()) return 'expirado';
  if (v.max_uses > 0 && v.uses_count >= v.max_uses) return 'esgotado';
  return 'activo';
}

const STATUS_CFG = {
  activo:   { label: 'Activo',   cls: 'bg-[#ECFDF5] text-[#1A7A4A] border-[#BBF7D0]' },
  expirado: { label: 'Expirado', cls: 'bg-n-100 text-n-500 border-n-200'             },
  esgotado: { label: 'Esgotado', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  inactivo: { label: 'Inactivo', cls: 'bg-red-50 text-error border-red-100'           },
};

function fmtDiscount(v) {
  return v.type === 'percent' ? `${v.value}%` : `€${Number(v.value).toFixed(0)}`;
}

/* ── CopyBtn ── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-xs font-body font-medium transition-colors ${copied ? 'text-[#1A7A4A] bg-[#ECFDF5]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.75} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

/* ── VoucherModal ── */
function VoucherModal({ voucher, units, onSave, onClose }) {
  const isNew = !voucher || voucher._new;
  const base  = voucher && !voucher._new ? voucher : null;

  const [form, setForm] = useState({
    code:       base?.code       || generateCode(),
    type:       base?.type       || 'percent',
    value:      base?.value      || '',
    min_amount: base?.min_amount || '',
    expires_at: base?.expires_at || '',
    max_uses:   base?.max_uses   || '',
    unit_ids:   base?.unit_ids   || [],
    active:     base?.active     ?? true,
  });
  const [error, setError] = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function toggleUnit(id) {
    setForm(p => ({
      ...p,
      unit_ids: p.unit_ids.includes(id)
        ? p.unit_ids.filter(x => x !== id)
        : [...p.unit_ids, id],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.code.trim()) { setError('O codigo e obrigatorio.'); return; }
    if (!form.value || Number(form.value) <= 0) { setError('O valor do desconto deve ser maior que zero.'); return; }
    setError('');
    onSave({
      ...base,
      ...form,
      code:       form.code.trim().toUpperCase(),
      value:      Number(form.value),
      min_amount: form.min_amount ? Number(form.min_amount) : 0,
      max_uses:   form.max_uses   ? Number(form.max_uses)   : 0,
      uses_count: base?.uses_count ?? 0,
      id:         base?.id || Date.now().toString(),
      created_at: base?.created_at || new Date().toISOString(),
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo voucher' : 'Editar voucher'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input label="Codigo" value={form.code} onChange={set('code')} required
              className="font-mono uppercase" placeholder="Ex: VERAO2025" />
          </div>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => setForm(p => ({ ...p, code: generateCode() }))}>
            Gerar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de desconto" value={form.type} onChange={set('type')}>
            <option value="percent">Percentagem (%)</option>
            <option value="fixed">Valor fixo (€)</option>
          </Select>
          <Input
            label={form.type === 'percent' ? 'Desconto (%)' : 'Desconto (€)'}
            type="number" min="0.01" step={form.type === 'percent' ? '1' : '0.01'}
            max={form.type === 'percent' ? '100' : undefined}
            value={form.value} onChange={set('value')} required
            placeholder={form.type === 'percent' ? '20' : '10.00'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Minimo de reserva (€)"
            type="number" min="0" step="1"
            value={form.min_amount} onChange={set('min_amount')}
            placeholder="0 = sem minimo"
          />
          <Input
            label="Limite de usos"
            type="number" min="0" step="1"
            value={form.max_uses} onChange={set('max_uses')}
            placeholder="0 = ilimitado"
          />
        </div>

        <Input
          label="Valido ate"
          type="date"
          value={form.expires_at} onChange={set('expires_at')}
        />

        {units.length > 0 && (
          <div>
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
              Tours aplicaveis
            </label>
            <p className="text-xs font-body text-n-400 mb-2">
              {form.unit_ids.length === 0 ? 'Aplicavel a todos os tours.' : `${form.unit_ids.length} tour(s) seleccionado(s).`}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {units.map(u => (
                <button key={u.id} type="button" onClick={() => toggleUnit(u.id)}
                  className={`text-xs px-2.5 py-1 rounded-sm border font-body transition-colors ${
                    form.unit_ids.includes(u.id)
                      ? 'bg-ocean-700 text-white border-ocean-700'
                      : 'bg-white text-n-600 border-n-200 hover:border-ocean-300'
                  }`}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">{isNew ? 'Criar voucher' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── ShareModal ── */
function ShareModal({ voucher, bookingLink, onClose }) {
  if (!voucher) return null;
  const discount = fmtDiscount(voucher);
  const expires  = voucher.expires_at ? ` Valido ate ${new Date(voucher.expires_at).toLocaleDateString('pt-PT')}.` : '';

  const msgPt = `Use o codigo *${voucher.code}* para obter ${discount} de desconto na sua proxima reserva.${expires} Reserve em: ${bookingLink}`;
  const msgEn = `Use code *${voucher.code}* to get ${discount} off your next booking.${expires} Book at: ${bookingLink}`;

  return (
    <Modal open onClose={onClose} title={`Partilhar — ${voucher.code}`} size="sm">
      <div className="space-y-4">
        <div className="bg-n-50 border border-n-200 rounded-sm p-3">
          <p className="text-xs font-mono font-semibold text-n-700">{voucher.code}</p>
          <p className="text-xs font-body text-n-600 mt-1">{fmtDiscount(voucher)} de desconto</p>
        </div>

        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">WhatsApp</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-body text-n-600 flex-1">PT</p>
              <CopyBtn text={msgPt} />
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msgPt)}`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-xs bg-[#25D366] text-white font-body font-medium hover:bg-[#1ebe5a] transition-colors">
                <Share2 size={11} strokeWidth={1.75} />Enviar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-body text-n-600 flex-1">EN</p>
              <CopyBtn text={msgEn} />
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msgEn)}`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-xs bg-[#25D366] text-white font-body font-medium hover:bg-[#1ebe5a] transition-colors">
                <Share2 size={11} strokeWidth={1.75} />Enviar
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Email</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Voucher especial para si')}&body=${encodeURIComponent(msgPt)}`, '_blank')}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors">
              <Mail size={14} strokeWidth={1.75} />Email PT
            </button>
            <button
              onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Special voucher for you')}&body=${encodeURIComponent(msgEn)}`, '_blank')}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors">
              <Mail size={14} strokeWidth={1.75} />Email EN
            </button>
          </div>
        </div>

        <Button variant="secondary" onClick={onClose} className="w-full justify-center">Fechar</Button>
      </div>
    </Modal>
  );
}

/* ── Main ── */
export default function Vouchers() {
  const { operator } = useAuthStore();
  const [vouchers,    setVouchers]    = useState(loadVouchers);
  const [units,       setUnits]       = useState([]);
  const [bookingLink, setBookingLink] = useState('');
  const [modal,       setModal]       = useState(null);
  const [shareModal,  setShareModal]  = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    listUnits().then(d => setUnits(d || [])).catch(() => {});
    getBookingLink()
      .then(d => setBookingLink(d?.url || d || ''))
      .catch(() => setBookingLink(operator?.booking_link_slug ? `https://saldesk.cv/book/${operator.booking_link_slug}` : ''));
  }, []);

  function persist(next) {
    const v = typeof next === 'function' ? next(vouchers) : next;
    setVouchers(v);
    saveVouchers(v);
  }

  function handleSave(v) {
    persist(prev => prev.find(x => x.id === v.id) ? prev.map(x => x.id === v.id ? v : x) : [...prev, v]);
    setModal(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Eliminar este voucher?')) return;
    persist(prev => prev.filter(v => v.id !== id));
  }

  function handleToggleActive(id) {
    persist(prev => prev.map(v => v.id === id ? { ...v, active: !v.active } : v));
  }

  const filtered = vouchers.filter(v => {
    const st = voucherStatus(v);
    if (filterStatus && st !== filterStatus) return false;
    if (search && !v.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.created_at?.localeCompare(a.created_at || '') || 0);

  /* Stats */
  const total   = vouchers.length;
  const active  = vouchers.filter(v => voucherStatus(v) === 'activo').length;
  const expired = vouchers.filter(v => voucherStatus(v) === 'expirado').length;
  const totalUses = vouchers.reduce((s, v) => s + (v.uses_count || 0), 0);

  return (
    <div>
      <PageHeader
        title="Vouchers e Promocoes"
        subtitle="Gerir codigos de desconto"
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>Novo voucher</Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total vouchers',  value: total,     icon: Tag      },
          { label: 'Activos',         value: active,    icon: Gift     },
          { label: 'Expirados',       value: expired,   icon: Calendar },
          { label: 'Total utilizacoes', value: totalUses, icon: BarChart2 },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-md border border-n-200 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
              <m.icon size={16} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div>
              <p className="font-display font-bold text-xl text-n-900">{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar codigo..."
          className="h-9 px-3 text-sm font-body border border-n-200 rounded-sm bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 flex-1 min-w-[160px] max-w-xs font-mono"
        />
        <div className="flex gap-1">
          {[{ v: '', l: 'Todos' }, { v: 'activo', l: 'Activos' }, { v: 'expirado', l: 'Expirados' }, { v: 'esgotado', l: 'Esgotados' }].map(o => (
            <button key={o.v} onClick={() => setFilterStatus(o.v)}
              className={`px-3 py-1.5 rounded-sm text-xs font-body font-semibold transition-colors ${filterStatus === o.v ? 'bg-ocean-700 text-white' : 'bg-white border border-n-200 text-n-600 hover:border-ocean-300'}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <Card>
          <div className="text-center py-14">
            <Tag size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
            <p className="font-display font-semibold text-n-700 mb-1">Sem vouchers</p>
            <p className="text-sm font-body text-n-400 mb-4">Crie o primeiro codigo de desconto para os seus clientes.</p>
            <Button icon={Plus} onClick={() => setModal({ _new: true })}>Criar voucher</Button>
          </div>
        </Card>
      ) : (
        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n-200">
                  {['Codigo', 'Desconto', 'Minimo', 'Validade', 'Usos', 'Tours', 'Estado', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {sorted.map(v => {
                  const st  = voucherStatus(v);
                  const cfg = STATUS_CFG[st];
                  const isExpiringSoon = v.expires_at && st === 'activo' &&
                    (new Date(v.expires_at) - new Date()) < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <tr key={v.id} className={`hover:bg-n-50 transition-colors ${!v.active ? 'opacity-60' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-n-900 tracking-wider">{v.code}</span>
                          <CopyBtn text={v.code} />
                        </div>
                      </td>
                      <td className="py-3 px-4 font-display font-bold text-ocean-700">{fmtDiscount(v)}</td>
                      <td className="py-3 px-4 text-xs font-body text-n-500">
                        {v.min_amount > 0 ? `€${v.min_amount}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-n-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isExpiringSoon && <AlertTriangle size={12} strokeWidth={1.75} className="text-yellow-600 shrink-0" />}
                          {v.expires_at ? new Date(v.expires_at).toLocaleDateString('pt-PT') : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-n-700">
                        {v.uses_count || 0}{v.max_uses > 0 ? `/${v.max_uses}` : ''}
                      </td>
                      <td className="py-3 px-4 text-xs font-body text-n-500">
                        {v.unit_ids?.length > 0
                          ? `${v.unit_ids.length} tour(s)`
                          : <span className="text-n-400">Todos</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-xs border ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setShareModal(v)}
                            className="p-1.5 rounded text-n-400 hover:text-[#25D366] hover:bg-n-100 transition-colors" title="Partilhar">
                            <Share2 size={13} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => setModal(v)}
                            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title="Editar">
                            <Pencil size={13} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => handleToggleActive(v.id)}
                            className="p-1.5 rounded text-n-400 hover:text-n-700 hover:bg-n-100 transition-colors" title={v.active ? 'Desactivar' : 'Activar'}>
                            <RefreshCw size={13} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => handleDelete(v.id)}
                            className="p-1.5 rounded text-n-400 hover:text-error hover:bg-red-50 transition-colors" title="Eliminar">
                            <Trash2 size={13} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <VoucherModal
          voucher={modal}
          units={units}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {shareModal && (
        <ShareModal
          voucher={shareModal}
          bookingLink={bookingLink}
          onClose={() => setShareModal(null)}
        />
      )}
    </div>
  );
}
