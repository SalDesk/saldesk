import { useState, useEffect } from 'react';
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
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import FilterChips from '../components/ui/FilterChips';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Input, { Select } from '../components/ui/Input';
import MareStat from '../components/shared/MareStat';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';
import { useT, getT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { formatarData, useLingua } from '../utils/formatoLingua';
import { euroPreco } from '../utils/formatoVendedor';
import { eurosInteiros } from './reservations/shared';

/* ── Estilo Mare: cartao de pagina e figuras (codigos, descontos, datas, contagens) ── */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const NUM = 'font-mono tabular-nums';

/* ── Helpers ── */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* estado calculado (activo, expirado, esgotado, inactivo); o rotulo vem de vouchersPage.status */
function voucherStatus(v) {
  if (!v.active) return 'inactivo';
  if (v.expires_at && new Date(v.expires_at) < new Date()) return 'expirado';
  if (v.max_uses > 0 && v.uses_count >= v.max_uses) return 'esgotado';
  return 'activo';
}

const STATUS_VARIANT = {
  activo: 'confirmed',
  expirado: 'default',
  esgotado: 'pending',
  inactivo: 'cancelled',
};

function fmtDiscount(v, lang) {
  return v.type === 'percent' ? `${v.value}%` : eurosInteiros(v.value, lang);
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
      className={`flex items-center gap-1.5 text-xs px-2 py-1 min-h-11 md:min-h-8 rounded-xs font-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${copied ? 'text-[var(--success)] bg-[var(--success-light)]' : 'text-ocean-700 bg-ocean-50 hover:bg-ocean-100'}`}>
      {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.75} />}
      {copied ? t('vouchersPage.copied') : t('vouchersPage.copy')}
    </button>
  );
}

/* ── VoucherModal ── */
function VoucherModal({ voucher, units, onSave, onClose }) {
  const t = useT();
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
    if (!form.code.trim()) { setError(t('vouchersPage.modal.errCode')); return; }
    if (!form.value || Number(form.value) <= 0) { setError(t('vouchersPage.modal.errValue')); return; }
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
      setError(mensagemErro(err, t, t('vouchersPage.modal.errSave')));
    } finally {
      setSaving(false);
    }
  }

  const rotuloDesconto = form.type === 'percent' ? t('vouchersPage.modal.discountPct') : t('vouchersPage.modal.discountEur');

  return (
    <Modal open onClose={onClose} title={isNew ? t('vouchersPage.modal.titleNew') : t('vouchersPage.modal.titleEdit')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input label={t('vouchersPage.modal.code')} aria-label={t('vouchersPage.modal.code')} value={form.code} onChange={set('code')} required
              className="font-mono uppercase" placeholder={t('vouchersPage.modal.codePlaceholder')} />
          </div>
          <Button type="button" variant="secondary" size="sm" className="min-h-11 md:min-h-0"
            onClick={() => setForm(p => ({ ...p, code: generateCode() }))}>
            {t('vouchersPage.modal.generate')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label={t('vouchersPage.modal.discountType')} aria-label={t('vouchersPage.modal.discountType')} value={form.type} onChange={set('type')}>
            <option value="percent">{t('vouchersPage.modal.typePercent')}</option>
            <option value="fixed">{t('vouchersPage.modal.typeFixed')}</option>
          </Select>
          <Input
            label={rotuloDesconto}
            aria-label={rotuloDesconto}
            type="number" min={form.type === 'percent' ? '1' : '0.01'} step={form.type === 'percent' ? '1' : '0.01'}
            max={form.type === 'percent' ? '100' : undefined}
            value={form.value} onChange={set('value')} required
            placeholder={form.type === 'percent' ? '20' : '10.00'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('vouchersPage.modal.minBooking')}
            aria-label={t('vouchersPage.modal.minBooking')}
            type="number" min="0" step="1"
            value={form.min_amount} onChange={set('min_amount')}
            placeholder={t('vouchersPage.modal.minPlaceholder')}
          />
          <Input
            label={t('vouchersPage.modal.maxUses')}
            aria-label={t('vouchersPage.modal.maxUses')}
            type="number" min="0" step="1"
            value={form.max_uses} onChange={set('max_uses')}
            placeholder={t('vouchersPage.modal.maxPlaceholder')}
          />
        </div>

        <Input
          label={t('vouchersPage.modal.validUntil')}
          aria-label={t('vouchersPage.modal.validUntil')}
          type="date"
          value={form.expires_at} onChange={set('expires_at')}
        />

        {units.length > 0 && (
          <div>
            <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
              {t('vouchersPage.modal.applicableTours')}
            </label>
            <p className="text-xs font-body text-n-400 mb-2">
              {form.unit_ids.length === 0 ? t('vouchersPage.modal.allToursApply') : t('vouchersPage.modal.selectedTours', { n: form.unit_ids.length })}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {units.map(u => (
                <button key={u.id} type="button" onClick={() => toggleUnit(u.id)}
                  className={`text-xs px-2.5 py-1 min-h-11 md:min-h-0 rounded-sm border font-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${
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
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('vouchersPage.modal.cancel')}</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? t('vouchersPage.modal.create') : t('vouchersPage.modal.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── ShareModal ── */
function ShareModal({ voucher, bookingLink, onClose }) {
  const t = useT();
  const lang = useLingua();
  if (!voucher) return null;

  /* Os textos para o cliente ficam na lingua deles (pt e en), qualquer que seja a lingua do painel. Cada
     mensagem leva a frase de validade e a data na sua propria lingua. */
  const tPt = getT('pt');
  const tEn = getT('en');
  const desconto = fmtDiscount(voucher, 'pt');
  const validade = (tl, lingua) => (voucher.expires_at
    ? tl('vouchersPage.share.expires', { date: formatarData(new Date(voucher.expires_at), { timeZone: 'UTC' }, lingua) })
    : '');

  const dadosMsg = { code: voucher.code, discount: desconto, link: bookingLink };
  const msgPt = tPt('vouchersPage.share.message', { ...dadosMsg, expires: validade(tPt, 'pt') });
  const msgEn = tEn('vouchersPage.share.message', { ...dadosMsg, expires: validade(tEn, 'en') });

  return (
    <Modal open onClose={onClose} title={t('vouchersPage.share.title', { code: voucher.code })} size="sm">
      <div className="space-y-4">
        <div className="bg-mare-head border border-mare-card rounded-[14px] p-3">
          <p className={`${NUM} text-xs font-semibold text-n-700 break-all`}>{voucher.code}</p>
          <p className="text-xs font-body text-n-600 mt-1">{t('vouchersPage.share.discountOff', { discount: fmtDiscount(voucher, lang) })}</p>
        </div>

        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">{t('vouchersPage.share.whatsapp')}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-body text-n-600 flex-1">PT</p>
              <CopyBtn text={msgPt} />
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msgPt)}`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 text-xs px-2 py-1 min-h-11 md:min-h-0 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 bg-[var(--success)] text-white font-body font-medium hover:opacity-90 transition-opacity">
                <Share2 size={11} strokeWidth={1.75} />{t('vouchersPage.share.send')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-body text-n-600 flex-1">EN</p>
              <CopyBtn text={msgEn} />
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msgEn)}`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 text-xs px-2 py-1 min-h-11 md:min-h-0 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 bg-[var(--success)] text-white font-body font-medium hover:opacity-90 transition-opacity">
                <Share2 size={11} strokeWidth={1.75} />{t('vouchersPage.share.send')}
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">{t('vouchersPage.share.email')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`mailto:?subject=${encodeURIComponent(tPt('vouchersPage.share.subject'))}&body=${encodeURIComponent(msgPt)}`, '_blank')}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors">
              <Mail size={14} strokeWidth={1.75} />{t('vouchersPage.share.emailPt')}
            </button>
            <button
              onClick={() => window.open(`mailto:?subject=${encodeURIComponent(tEn('vouchersPage.share.subject'))}&body=${encodeURIComponent(msgEn)}`, '_blank')}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-sm bg-n-100 text-n-700 font-body hover:bg-n-200 transition-colors">
              <Mail size={14} strokeWidth={1.75} />{t('vouchersPage.share.emailEn')}
            </button>
          </div>
        </div>

        <Button variant="secondary" onClick={onClose} className="w-full justify-center">{t('vouchersPage.share.close')}</Button>
      </div>
    </Modal>
  );
}

/* ── Main ── */
export default function Vouchers() {
  const t = useT();
  const lang = useLingua();
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
    if (!window.confirm(t('vouchersPage.confirmDelete'))) return;
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
      key: 'codigo', label: t('vouchersPage.columns.code'),
      render: v => (
        <div className={`flex flex-wrap items-center gap-2 ${!v.active ? 'opacity-60' : ''}`}>
          <span className={`${NUM} font-bold text-n-900 tracking-wider break-all min-w-0`}>{v.code}</span>
          <CopyBtn text={v.code} />
        </div>
      ),
    },
    { key: 'desconto', label: t('vouchersPage.columns.discount'), render: v => <span className={`${NUM} font-bold text-ocean-700`}>{fmtDiscount(v, lang)}</span> },
    { key: 'minimo', label: t('vouchersPage.columns.minimum'), render: v => <span className={`${NUM} text-xs text-n-500`}>{v.min_amount > 0 ? euroPreco(v.min_amount, lang) : '—'}</span> },
    {
      key: 'validade', label: t('vouchersPage.columns.validity'),
      render: v => {
        const st = voucherStatus(v);
        const isExpiringSoon = v.expires_at && st === 'activo' &&
          (new Date(v.expires_at) - new Date()) < 7 * 24 * 60 * 60 * 1000;
        return (
          <div className={`flex items-center gap-1.5 text-xs ${NUM} text-n-500 whitespace-nowrap`}>
            {isExpiringSoon && <AlertTriangle size={12} strokeWidth={1.75} className="text-[var(--warning)] shrink-0" />}
            {v.expires_at ? formatarData(new Date(v.expires_at), { timeZone: 'UTC' }, lang) : '—'}
          </div>
        );
      },
    },
    { key: 'usos', label: t('vouchersPage.columns.uses'), render: v => <span className={`${NUM} text-n-700`}>{v.uses_count || 0}{v.max_uses > 0 ? `/${v.max_uses}` : ''}</span> },
    {
      key: 'tours', label: t('vouchersPage.columns.tours'),
      render: v => (
        <span className="text-xs font-body text-n-500">
          {v.unit_ids?.length > 0 ? t('vouchersPage.toursCount', { n: v.unit_ids.length }) : <span>{t('vouchersPage.allTours')}</span>}
        </span>
      ),
    },
    {
      key: 'estado', label: t('vouchersPage.columns.status'),
      render: v => { const st = voucherStatus(v); return <Badge variant={STATUS_VARIANT[st]}>{t(`vouchersPage.status.${st}`)}</Badge>; },
    },
    {
      key: 'acoes', label: '',
      render: v => (
        <div className="flex items-center gap-0.5">
          <IconBtn icon={Share2} label={t('vouchersPage.actions.shareAria', { code: v.code })} title={t('vouchersPage.actions.share')}
            onClick={() => setShareModal(v)} hover="hover:text-[var(--success)] hover:bg-[var(--success-light)]" />
          <IconBtn icon={Pencil} label={t('vouchersPage.actions.editAria', { code: v.code })} title={t('vouchersPage.actions.edit')}
            onClick={() => setModal(v)} hover={EDIT_HOVER} />
          <IconBtn icon={RefreshCw} label={t(v.active ? 'vouchersPage.actions.deactivateAria' : 'vouchersPage.actions.activateAria', { code: v.code })}
            title={t(v.active ? 'vouchersPage.actions.deactivate' : 'vouchersPage.actions.activate')}
            onClick={() => handleToggleActive(v)} hover="hover:text-n-800 hover:bg-n-100" />
          <IconBtn icon={Trash2} label={t('vouchersPage.actions.deleteAria', { code: v.code })} title={t('vouchersPage.actions.delete')}
            onClick={() => handleDelete(v.id)} hover={DELETE_HOVER} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.crescimento')}
        title={t('vouchersPage.title')}
        subtitle={t('vouchersPage.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('vouchersPage.newVoucher')}</Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MareStat label={t('vouchersPage.stats.total')} value={total} icon={Tag} />
        <MareStat label={t('vouchersPage.stats.active')} value={active} icon={Gift} />
        <MareStat label={t('vouchersPage.stats.expired')} value={expired} icon={Calendar} />
        <MareStat label={t('vouchersPage.stats.totalUses')} value={totalUses} icon={BarChart2} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[160px] max-w-xs">
          <Input aria-label={t('vouchersPage.searchAria')} value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('vouchersPage.searchPlaceholder')} className="font-mono" />
        </div>
        <FilterChips
          options={[
            { value: '', label: t('vouchersPage.filters.all') },
            { value: 'activo', label: t('vouchersPage.filters.active') },
            { value: 'expirado', label: t('vouchersPage.filters.expired') },
            { value: 'esgotado', label: t('vouchersPage.filters.usedUp') },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {/* List */}
      {loading ? (
        <section className={CARTAO}><div className="text-center py-14 text-n-500 text-sm font-body">{t('vouchersPage.loading')}</div></section>
      ) : sorted.length === 0 ? (
        <section className="bg-white rounded-[18px] border border-mare-card min-w-0 overflow-hidden">
          <EmptyState icon={Tag} title={t('vouchersPage.empty.title')}
            description={t('vouchersPage.empty.description')}
            action={<Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('vouchersPage.empty.create')}</Button>} />
        </section>
      ) : (
        <section className="bg-white rounded-[18px] border border-mare-card min-w-0 overflow-hidden">
          <Table columns={columns} rows={sorted} compact />
        </section>
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
