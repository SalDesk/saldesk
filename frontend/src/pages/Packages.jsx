import { useState, useEffect } from 'react';
import {
  Package, Plus, Pencil, Trash2, Eye, EyeOff,
  Image as ImageIcon,
} from 'lucide-react';
import { listUnits } from '../services/unitsService';
import { listPackages, createPackage, updatePackage, deletePackage } from '../services/packagesService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Input, { Textarea, Select } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData, formatarNumero, useLingua } from '../utils/formatoLingua';
import { euroPreco } from '../utils/formatoVendedor';
import { eurosInteiros } from './reservations/shared';

/* estados gravados do pacote (activo, inactivo, esgotado); o rotulo vem de packagesPage.status */
const STATUS_VARIANT = {
  activo:   'confirmed',
  inactivo: 'default',
  esgotado: 'pending',
};

function fmtDate(d, lang) {
  if (!d) return '—';
  return formatarData(new Date(d + 'T00:00:00Z'), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }, lang);
}

/* ── PackageModal ── */
function PackageModal({ pkg, units, onSave, onClose }) {
  const t = useT();
  const lang = useLingua();
  const isNew = !pkg || pkg._new;
  const base  = isNew ? null : pkg;

  const [form, setForm] = useState({
    name_pt:       base?.name_pt       || '',
    name_en:       base?.name_en       || '',
    description_pt: base?.description_pt || '',
    description_en: base?.description_en || '',
    tour_ids:      base?.tour_ids      || [],
    valid_from:    base?.valid_from    || '',
    valid_to:      base?.valid_to      || '',
    price:         base?.price         || '',
    limit:         base?.limit         || '',
    photo_url:     base?.photo_url     || '',
    status:        base?.status        || 'activo',
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

  const originalPrice = form.tour_ids
    .map(id => Number(units.find(u => u.id === id)?.base_price || 0))
    .reduce((s, p) => s + p, 0);

  const savings = originalPrice > 0 && form.price > 0
    ? originalPrice - Number(form.price)
    : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(base?.id, {
        ...form,
        price:   Number(form.price),
        limit:   form.limit ? Number(form.limit) : 0,
        original_price: originalPrice,
      });
    } catch {
      setError(t('packagesPage.modal.errSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('packagesPage.modal.titleNew') : t('packagesPage.modal.titleEdit')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t('packagesPage.modal.namePt')} aria-label={t('packagesPage.modal.namePt')} value={form.name_pt} onChange={set('name_pt')} required placeholder={t('packagesPage.modal.namePtPlaceholder')} />
          <Input label={t('packagesPage.modal.nameEn')} aria-label={t('packagesPage.modal.nameEn')} value={form.name_en} onChange={set('name_en')} placeholder={t('packagesPage.modal.nameEnPlaceholder')} />
        </div>

        <Textarea label={t('packagesPage.modal.descPt')} aria-label={t('packagesPage.modal.descPt')} value={form.description_pt} onChange={set('description_pt')} rows={2} />
        <Textarea label={t('packagesPage.modal.descEn')} aria-label={t('packagesPage.modal.descEn')} value={form.description_en} onChange={set('description_en')} rows={2} />

        {/* Tour selection */}
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
            {t('packagesPage.modal.includedTours', { n: form.tour_ids.length })}
          </label>
          {units.length === 0 ? (
            <p className="text-xs font-body text-n-400">{t('packagesPage.modal.noTours')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {units.map(u => (
                <button key={u.id} type="button" onClick={() => toggleTour(u.id)}
                  className={`text-xs px-3 py-1.5 rounded-sm border font-body transition-colors ${
                    form.tour_ids.includes(u.id)
                      ? 'bg-ocean-700 text-white border-ocean-700'
                      : 'bg-white text-n-600 border-n-200 hover:border-ocean-300'
                  }`}>
                  {u.name}
                  {u.base_price > 0 && <span className="ml-1 opacity-70">{euroPreco(u.base_price, lang)}</span>}
                </button>
              ))}
            </div>
          )}
          {originalPrice > 0 && (
            <p className="text-xs font-body text-n-400 mt-1.5">
              {t('packagesPage.modal.sumTours')} <span className="font-semibold text-n-700">{euroPreco(originalPrice, lang)}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label={t('packagesPage.modal.price')} aria-label={t('packagesPage.modal.price')} type="number" min="0" step="0.01"
              value={form.price} onChange={set('price')} required placeholder={t('packagesPage.modal.pricePlaceholder')} />
            {savings > 0 && (
              <p className="text-xs font-body text-[var(--success)] mt-1">
                {t('packagesPage.modal.customerSaves', { amount: eurosInteiros(savings, lang) })}
              </p>
            )}
          </div>
          <Input label={t('packagesPage.modal.limit')} aria-label={t('packagesPage.modal.limit')} type="number" min="0"
            value={form.limit} onChange={set('limit')} placeholder="0" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('packagesPage.modal.validFrom')} aria-label={t('packagesPage.modal.validFrom')} type="date" value={form.valid_from} onChange={set('valid_from')} />
          <Input label={t('packagesPage.modal.validTo')} aria-label={t('packagesPage.modal.validTo')} type="date" value={form.valid_to} onChange={set('valid_to')} />
        </div>

        <Input label={t('packagesPage.modal.photo')} aria-label={t('packagesPage.modal.photo')} value={form.photo_url} onChange={set('photo_url')} placeholder={t('packagesPage.modal.photoPlaceholder')} />

        {!isNew && (
          <Select label={t('packagesPage.modal.status')} aria-label={t('packagesPage.modal.status')} value={form.status} onChange={set('status')}>
            {Object.keys(STATUS_VARIANT).map(k => <option key={k} value={k}>{t(`packagesPage.status.${k}`)}</option>)}
          </Select>
        )}

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('packagesPage.modal.cancel')}</Button>
          <Button type="submit" loading={saving} className="flex-1">{isNew ? t('packagesPage.modal.create') : t('packagesPage.modal.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Packages() {
  const t = useT();
  const lang = useLingua();
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [units,    setUnits]    = useState([]);
  const [modal,    setModal]    = useState(null);

  useEffect(() => { listUnits().then(d => setUnits(d || [])).catch(() => {}); }, []);
  useEffect(() => {
    listPackages().then(d => setPackages(d || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(id, dados) {
    const saved = id ? await updatePackage(id, dados) : await createPackage(dados);
    setPackages(prev => prev.find(p => p.id === saved.id) ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
    setModal(null);
  }

  async function handleDelete(id) {
    if (!window.confirm(t('packagesPage.confirmDelete'))) return;
    await deletePackage(id);
    setPackages(prev => prev.filter(p => p.id !== id));
  }

  async function handleToggleStatus(pkg) {
    const nextStatus = pkg.status === 'activo' ? 'inactivo' : 'activo';
    const updated = await updatePackage(pkg.id, { status: nextStatus });
    setPackages(prev => prev.map(p => p.id === pkg.id ? updated : p));
  }

  const totalRevenue = packages.reduce((s, p) => s + (p.bookings_count || 0) * (p.price || 0), 0);
  const totalBookings = packages.reduce((s, p) => s + (p.bookings_count || 0), 0);
  const activeCount = packages.filter(p => p.status === 'activo').length;

  if (loading) {
    return (
      <div>
        <PageHeader title={t('packagesPage.title')} subtitle={t('packagesPage.subtitle')} />
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('packagesPage.title')}
        subtitle={t('packagesPage.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('packagesPage.newPackage')}</Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: t('packagesPage.kpi.active'),   value: activeCount,                            color: 'text-n-900'     },
          { label: t('packagesPage.kpi.bookings'), value: totalBookings,                          color: 'text-ocean-700' },
          { label: t('packagesPage.kpi.revenue'),  value: `€${formatarNumero(Math.round(totalRevenue), {}, lang)}`, color: 'text-[var(--success)]' },
        ].map(m => (
          <Card key={m.label} padding="px-4 py-3">
            <div className="flex items-center gap-3">
              <Package size={16} strokeWidth={1.75} className="text-n-300 shrink-0" />
              <div>
                <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
                <p className="text-xs font-body text-n-500">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Note about public visibility */}
      <div className="mb-4 px-4 py-2.5 bg-[var(--info-light)] border border-[var(--info)] rounded-sm">
        <p className="text-xs font-body text-[var(--info)]">
          {t('packagesPage.publicNote')} <span className="font-mono">/public/:slug/packages</span>.
        </p>
      </div>

      {packages.length === 0 ? (
        <Card padding="p-0">
          <EmptyState icon={Package} title={t('packagesPage.empty.title')}
            description={t('packagesPage.empty.description')}
            action={<Button icon={Plus} onClick={() => setModal({ _new: true })}>{t('packagesPage.empty.create')}</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(pkg => {
            const statusKey = Object.prototype.hasOwnProperty.call(STATUS_VARIANT, pkg.status) ? pkg.status : 'activo';
            const tours   = (pkg.tour_ids || []).map(id => units.find(u => u.id === id)).filter(Boolean);
            const savings = (pkg.original_price || 0) - (pkg.price || 0);
            const isExpired = pkg.valid_to && new Date(pkg.valid_to + 'T00:00:00Z') < new Date();
            const isFull = pkg.limit > 0 && pkg.bookings_count >= pkg.limit;

            return (
              <Card key={pkg.id} padding="p-0" className={`overflow-hidden ${pkg.status !== 'activo' ? 'opacity-70' : ''}`}>
                {/* Photo */}
                <div className="h-32 bg-n-100 relative overflow-hidden">
                  {pkg.photo_url ? (
                    <img src={pkg.photo_url} alt={pkg.name_pt}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon size={28} strokeWidth={1.25} className="text-n-300" />
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2" variant={isFull ? 'pending' : isExpired ? 'default' : STATUS_VARIANT[statusKey]}>
                    {isFull ? t('packagesPage.status.esgotado') : isExpired ? t('packagesPage.status.expirado') : t(`packagesPage.status.${statusKey}`)}
                  </Badge>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="font-display font-semibold text-sm text-n-900">{pkg.name_pt}</p>
                    {pkg.description_pt && (
                      <p className="text-xs font-body text-n-500 mt-0.5 line-clamp-2">{pkg.description_pt}</p>
                    )}
                  </div>

                  {/* Tours */}
                  <div className="flex flex-wrap gap-1">
                    {tours.slice(0, 3).map(tour => (
                      <span key={tour.id} className="text-[10px] font-body bg-ocean-50 text-ocean-700 px-1.5 py-0.5 rounded-xs">
                        {tour.name}
                      </span>
                    ))}
                    {tours.length > 3 && (
                      <span className="text-[10px] font-mono text-n-400">+{tours.length - 3}</span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-end gap-3">
                    <div>
                      <p className="font-display font-bold text-lg text-ocean-700">{euroPreco(pkg.price, lang)}</p>
                      {pkg.original_price > 0 && (
                        <p className="text-[10px] font-body text-n-400 line-through">{euroPreco(pkg.original_price, lang)}</p>
                      )}
                    </div>
                    {savings > 0 && (
                      <span className="text-xs font-body font-semibold text-[var(--success)] bg-[var(--success-light)] px-1.5 py-0.5 rounded-xs">
                        {t('packagesPage.card.saves', { amount: eurosInteiros(savings, lang) })}
                      </span>
                    )}
                  </div>

                  {/* Validity */}
                  {(pkg.valid_from || pkg.valid_to) && (
                    <p className="text-[10px] font-mono text-n-400">
                      {fmtDate(pkg.valid_from, lang)} — {fmtDate(pkg.valid_to, lang)}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 pt-1 border-t border-n-100">
                    <span className="text-xs font-mono text-n-500">
                      {t('packagesPage.card.bookings', { n: pkg.bookings_count || 0 })}
                    </span>
                    {pkg.limit > 0 && (
                      <span className="text-xs font-mono text-n-400">
                        {t('packagesPage.card.remaining', { n: Math.max(0, pkg.limit - (pkg.bookings_count || 0)) })}
                      </span>
                    )}
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => handleToggleStatus(pkg)}
                        aria-label={t(pkg.status === 'activo' ? 'packagesPage.card.deactivateAria' : 'packagesPage.card.activateAria', { name: pkg.name_pt })}
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"
                        title={t(pkg.status === 'activo' ? 'packagesPage.card.deactivate' : 'packagesPage.card.activate')}>
                        {pkg.status === 'activo' ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
                      </button>
                      <button onClick={() => setModal(pkg)}
                        aria-label={t('packagesPage.card.editAria', { name: pkg.name_pt })}
                        className="p-1.5 rounded text-n-400 hover:text-ocean-700 hover:bg-ocean-50 transition-colors">
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDelete(pkg.id)}
                        aria-label={t('packagesPage.card.deleteAria', { name: pkg.name_pt })}
                        className="p-1.5 rounded text-n-400 hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-colors">
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modal && (
        <PackageModal
          pkg={modal}
          units={units}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
