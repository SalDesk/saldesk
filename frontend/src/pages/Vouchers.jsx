import { useState, useEffect, useCallback } from 'react';
import PlanGuard from '../components/PlanGuard';
import {
  Tag, Plus, Copy, Check, Share2, Pencil, Trash2,
  Mail, Calendar, AlertTriangle, BarChart2, Gift,
  RefreshCw,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import { getBookingLink } from '../services/marketingService';
import { listVouchers, createVoucher, updateVoucher, deleteVoucher } from '../services/vouchersService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import FilterChips from '../components/ui/FilterChips';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Input, { Select } from '../components/ui/Input';

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
  activo:   { label: 'Activo',   variant: 'confirmed' },
  expirado: { label: 'Expirado', variant: 'default'   },
  esgotado: { label: 'Esgotado', variant: 'pending'   },
  inactivo: { label: 'Inactivo', variant: 'cancelled' },
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
      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-xs font-body font-medium transition-colors ${copied ? 'text-[var(--success)] bg-[var(--success-light)]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
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
  const [saving, setSaving] = useState(false);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  function toggleUnit(id) {
    setForm(p => ({
      ...p,
      unit_ids: p.unit_ids.includes(id)
        ? p.unit_ids.filter(x => x !== id)
        : [...p.unit_ids, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.code.trim()) { setError('O codigo e obrigatorio.'); return; }
    if (!form.value || Number(form.value) <= 0) { setError('O valor do desconto deve ser maior que zero.'); return; }
    setError(''); setSaving(true);
    try {
      await onSave(base?.id, {
        ...form,
        code:       form.code.trim().toUpperCase(),
        value:      Number(form.value),
        min_amount: form.min_amount ? Number(form.min_amount) : 0,
        max_uses:   form.max_uses   ? Number(form.max_uses)   : 0,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao guardar voucher.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo voucher' : 'Editar voucher'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input label="Codigo" aria-label="Codigo" value={form.code} onChange={set('code')} required
              className="font-mono uppercase" placeholder="Ex: VERAO2025" />
          </div>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => setForm(p => ({ ...p, code: generateCode() }))}>
            Gerar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo de desconto" aria-label="Tipo de desconto" value={form.type} onChange={set('type')}>
            <option value="percent">Percentagem (%)</option>
            <option value="fixed">Valor fixo (€)</option>
          </Select>
          <Input
            label={form.type === 'percent' ? 'Desconto (%)' : 'Desconto (€)'}
            aria-label={form.type === 'percent' ? 'Desconto (%)' : 'Desconto (€)'}
            type="number" min={form.type === 'percent' ? '1' : '0.01'} step={form.type === 'percent' ? '1' : '0.01'}
            max={form.type === 'percent' ? '100' : undefined}
            value={form.value} onChange={set('value')} required
            placeholder={form.type === 'percent' ? '20' : '10.00'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Minimo de reserva (€)"
            aria-label="Minimo de reserva (€)"
            type="number" min="0" step="1"
            value={form.min_amount} onChange={set('min_amount')}
            placeholder="0 = sem minimo"
          />
          <Input
            label="Limite de usos"
            aria-label="Limite de usos"
            type="number" min="0" step="1"
            value={form.max_uses} onChange={set('max_uses')}
            placeholder="0 = ilimitado"
          />
        </div>

        <Input
          label="Valido ate"
          aria-label="Valido ate"
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

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? 'Criar voucher' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── ShareModal ── */
function ShareModal({ voucher, bookingLink, onClose }) {
  if (!voucher) return null;
  const discount = fmtDiscount(voucher);
  const expires  = voucher.expires_at ? ` Valido ate ${new Date(voucher.expires_at).toLocaleDateString('pt-PT', { timeZone: 'UTC' })}.` : '';

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
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-xs bg-[var(--success)] text-white font-body font-medium hover:opacity-90 transition-opacity">
                <Share2 size={11} strokeWidth={1.75} />Enviar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-body text-n-600 flex-1">EN</p>
              <CopyBtn text={msgEn} />
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msgEn)}`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-xs bg-[var(--success)] text-white font-body font-medium hover:opacity-90 transition-opacity">
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
  const [vouchers,    setVouchers]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [units,       setUnits]       = useState([]);
  const [bookingLink, setBookingLink] = useState('');
  const [modal,       setModal]       = useState(null);
  const [shareModal,  setShareModal]  = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    listVouchers().then(v => setVouchers(v || [])).catch(() => {}).finally(() => setLoading(false));
    listUnits().then(d => setUnits(d || [])).catch(() => {});
    getBookingLink()
      .then(d => setBookingLink(d?.url || d || ''))
      .catch(() => setBookingLink(operator?.slug ? `https://saldesk.cv/book/${operator.slug}` : ''));
  }, []);

  async function handleSave(id, payload) {
    const saved = id ? await updateVoucher(id, payload) : await createVoucher(payload);
    setVouchers(prev => prev.find(x => x.id === saved.id) ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]);
    setModal(null);
  }

  async function handleDelete(id) {
    if (!window.confirm('Eliminar este voucher?')) return;
    await deleteVoucher(id);
    setVouchers(prev => prev.filter(v => v.id !== id));
  }

  async function handleToggleActive(v) {
    const saved = await updateVoucher(v.id, { active: !v.active });
    setVouchers(prev => prev.map(x => x.id === saved.id ? saved : x));
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

  const columns = [
    {
      key: 'codigo', label: 'Codigo',
      render: v => (
        <div className={`flex items-center gap-2 ${!v.active ? 'opacity-60' : ''}`}>
          <span className="font-mono font-bold text-n-900 tracking-wider">{v.code}</span>
          <CopyBtn text={v.code} />
        </div>
      ),
    },
    { key: 'desconto', label: 'Desconto', render: v => <span className="font-display font-bold text-ocean-700">{fmtDiscount(v)}</span> },
    { key: 'minimo', label: 'Minimo', render: v => <span className="text-xs font-body text-n-500">{v.min_amount > 0 ? `€${v.min_amount}` : '—'}</span> },
    {
      key: 'validade', label: 'Validade',
      render: v => {
        const st = voucherStatus(v);
        const isExpiringSoon = v.expires_at && st === 'activo' &&
          (new Date(v.expires_at) - new Date()) < 7 * 24 * 60 * 60 * 1000;
        return (
          <div className="flex items-center gap-1.5 text-xs font-mono text-n-500 whitespace-nowrap">
            {isExpiringSoon && <AlertTriangle size={12} strokeWidth={1.75} className="text-[var(--warning)] shrink-0" />}
            {v.expires_at ? new Date(v.expires_at).toLocaleDateString('pt-PT', { timeZone: 'UTC' }) : '—'}
          </div>
        );
      },
    },
    { key: 'usos', label: 'Usos', render: v => <span className="font-mono text-n-700">{v.uses_count || 0}{v.max_uses > 0 ? `/${v.max_uses}` : ''}</span> },
    {
      key: 'tours', label: 'Tours',
      render: v => (
        <span className="text-xs font-body text-n-500">
          {v.unit_ids?.length > 0 ? `${v.unit_ids.length} tour(s)` : <span className="text-n-400">Todos</span>}
        </span>
      ),
    },
    {
      key: 'estado', label: 'Estado',
      render: v => { const cfg = STATUS_CFG[voucherStatus(v)]; return <Badge variant={cfg.variant}>{cfg.label}</Badge>; },
    },
    {
      key: 'acoes', label: '',
      render: v => (
        <div className="flex items-center gap-0.5">
          <button onClick={() => setShareModal(v)} aria-label={`Partilhar ${v.code}`}
            className="p-1.5 rounded text-n-400 hover:text-[var(--success)] hover:bg-n-100 transition-colors" title="Partilhar">
            <Share2 size={13} strokeWidth={1.75} />
          </button>
          <button onClick={() => setModal(v)} aria-label={`Editar ${v.code}`}
            className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors" title="Editar">
            <Pencil size={13} strokeWidth={1.75} />
          </button>
          <button onClick={() => handleToggleActive(v)} aria-label={`${v.active ? 'Desactivar' : 'Activar'} ${v.code}`}
            className="p-1.5 rounded text-n-400 hover:text-n-700 hover:bg-n-100 transition-colors" title={v.active ? 'Desactivar' : 'Activar'}>
            <RefreshCw size={13} strokeWidth={1.75} />
          </button>
          <button onClick={() => handleDelete(v.id)} aria-label={`Eliminar ${v.code}`}
            className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors" title="Eliminar">
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      ),
    },
  ];

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
          <Card key={m.label} padding="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                <m.icon size={16} strokeWidth={1.75} className="text-ocean-700" />
              </div>
              <div>
                <p className="font-display font-bold text-xl text-n-900">{m.value}</p>
                <p className="text-xs font-body text-n-500">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[160px] max-w-xs">
          <Input aria-label="Pesquisar codigo" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar codigo..." className="font-mono" />
        </div>
        <FilterChips
          options={[{ value: '', label: 'Todos' }, { value: 'activo', label: 'Activos' }, { value: 'expirado', label: 'Expirados' }, { value: 'esgotado', label: 'Esgotados' }]}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {/* List */}
      {loading ? (
        <Card><div className="text-center py-14 text-n-400 text-sm font-body">A carregar...</div></Card>
      ) : sorted.length === 0 ? (
        <Card padding="p-0">
          <EmptyState icon={Tag} title="Sem vouchers"
            description="Crie o primeiro codigo de desconto para os seus clientes."
            action={<Button icon={Plus} onClick={() => setModal({ _new: true })}>Criar voucher</Button>} />
        </Card>
      ) : (
        <Card padding="p-0">
          <Table columns={columns} rows={sorted} compact />
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
