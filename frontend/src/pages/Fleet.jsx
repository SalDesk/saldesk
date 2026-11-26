import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Car, Wrench, Package, Users, Compass, CheckCircle } from 'lucide-react';
import { listFleet, createFleet, updateFleet, deleteFleet } from '../services/fleetService';
import { listUnits } from '../services/unitsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Input, { Select, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MareStat from '../components/shared/MareStat';
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { IconBtn, EDIT_HOVER, DELETE_HOVER } from '../components/shared/IconBtn';

const TYPE_ICONS = { vehicle: Car, equipment: Wrench, gear: Package };
/* Tipos e estados gravados (type, status); o rotulo vem de fleet.types e fleet.status */
const TYPES = ['vehicle', 'equipment', 'gear'];
const STATUSES = ['available', 'in_use', 'maintenance', 'retired'];
/* Variantes do Badge do sistema: disponivel verde, em uso azul, manutencao ambar, retirado neutro */
const STATUS_BADGE = { available: 'confirmed', in_use: 'checked_in', maintenance: 'pending', retired: 'no_show' };
const CAPACIDADES = [2, 4, 6, 8, 10, 12];

/* Um estado que a pagina nao conhece fica sem rotulo, como sempre */
const rotuloEstado = (status, t) => (STATUSES.includes(status) ? t(`fleet.status.${status}`) : undefined);

function FleetForm({ item, units, onSave, onCancel, loading, error }) {
  const t = useT();
  const [form, setForm] = useState({
    name:                item?.name || '',
    plate:               item?.plate || '',
    type:                item?.type || 'vehicle',
    description:         item?.description || '',
    notes:               item?.notes || '',
    status:              item?.status || 'available',
    last_maintenance_at: item?.last_maintenance_at?.split('T')[0] || '',
    next_maintenance_at: item?.next_maintenance_at?.split('T')[0] || '',
    capacity:            item?.capacity || 2,
    unit_id:             item?.unit_id || '',
    photo:               item?.images?.[0] || '',
  });
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      unit_id: form.unit_id || null,
      images:  form.photo ? [form.photo] : (item?.images || []),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label={t('fleet.form.name')} value={form.name} onChange={set('name')} required placeholder={t('fleet.form.namePlaceholder')} />
      <Input label={t('fleet.form.plate')} value={form.plate} onChange={set('plate')} placeholder="SL-00-AA" />
      <div className="grid grid-cols-2 gap-3">
        <Select label={t('fleet.form.type')} value={form.type} onChange={set('type')} required>
          {TYPES.map((tipo) => <option key={tipo} value={tipo}>{t(`fleet.types.${tipo}`)}</option>)}
        </Select>
        {item && (
          <Select label={t('fleet.form.status')} value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`fleet.status.${s}`)}</option>)}
          </Select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label={t('fleet.form.capacity')} value={form.capacity} onChange={(e) => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}>
          {CAPACIDADES.map((n) => <option key={n} value={n}>{t('fleet.seats', { n })}</option>)}
        </Select>
        <Select label={t('fleet.form.unit')} value={form.unit_id} onChange={set('unit_id')}>
          <option value="">{t('fleet.form.noUnit')}</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>
      <Textarea label={t('fleet.form.description')} value={form.description} onChange={set('description')} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('fleet.form.lastMaint')} type="date" value={form.last_maintenance_at} onChange={set('last_maintenance_at')} />
        <Input label={t('fleet.form.nextMaint')} type="date" value={form.next_maintenance_at} onChange={set('next_maintenance_at')} />
      </div>
      <div>
        <label htmlFor="fleet-foto" className="block text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-1 app:normal-case app:tracking-normal app:text-[13px] app:text-n-700">{t('fleet.form.photo')}</label>
        {form.photo && (
          <img src={form.photo} alt={t('fleet.types.vehicle')} className="w-full h-40 object-cover rounded-sm mb-2 border border-n-200" />
        )}
        <input
          id="fleet-foto"
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => setForm(f => ({ ...f, photo: ev.target.result }));
            reader.readAsDataURL(file);
          }}
          className="text-sm font-body text-n-500"
        />
      </div>
      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">{item ? t('common.save') : t('fleet.form.create')}</Button>
      </div>
    </form>
  );
}

export default function Fleet() {
  const t = useT();
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    Promise.all([listFleet(), listUnits()])
      .then(([fleet, unitsList]) => { setItems(fleet); setUnits(unitsList || []); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(dados) {
    setFormError(''); setFormLoading(true);
    try {
      if (modal === 'create') {
        const item = await createFleet(dados);
        setItems([item, ...items]);
      } else {
        const item = await updateFleet(modal.id, dados);
        setItems(items.map((i) => (i.id === item.id ? item : i)));
      }
      setModal(null);
    } catch (err) {
      setFormError(mensagemErro(err, t, t('fleet.errorSave')));
    } finally { setFormLoading(false); }
  }

  async function handleDelete() {
    try {
      await deleteFleet(deleteTarget.id);
      setItems(items.filter((i) => i.id !== deleteTarget.id));
    } finally { setDeleteTarget(null); }
  }

  const available = items.filter((i) => i.status === 'available').length;
  const emManutencao = items.filter((i) => i.status === 'maintenance').length;

  return (
    <div>
      <PageHeader eyebrow={t('nav.sections.operacao')} title={t('fleet.title')} subtitle={t('fleet.subtitle', { available, total: items.length })}
        actions={<Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>{t('fleet.newItem')}</Button>} />

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <MareStat label={t('fleet.stats.total')} value={items.length} icon={Car} />
          <MareStat label={t('fleet.stats.available')} value={available} icon={CheckCircle} tone="bom" />
          <MareStat label={t('fleet.stats.maintenance')} value={emManutencao} icon={Wrench} tone="aviso" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : items.length === 0 ? (
        <Card padding="p-0"><EmptyState icon={Car} title={t('fleet.empty')} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || Package;
            const manutencaoAtrasada = item.next_maintenance_at && new Date(item.next_maintenance_at) < new Date();
            /* data gravada sem a hora (AAAA-MM-DD), como sempre */
            const dataManutencao = item.next_maintenance_at?.split('T')[0];
            return (
              <div key={item.id} className="flex flex-col overflow-hidden rounded-[18px] border border-mare-card bg-white">
                {/* Photo / placeholder */}
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt={item.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-mare-head border-b border-mare-card flex items-center justify-center">
                    <Icon size={32} strokeWidth={1.25} className="text-ocean-300" />
                  </div>
                )}

                {/* Body */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-n-900 truncate">{item.name}</p>
                      {item.plate && (
                        <p className="text-xs font-mono tabular-nums text-n-500 mt-0.5">{item.plate}</p>
                      )}
                    </div>
                    <Badge variant={STATUS_BADGE[item.status] || 'default'}>{rotuloEstado(item.status, t)}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.capacity && (
                      <span className="inline-flex items-center gap-1 text-xs font-body text-n-600 bg-mare-head border border-mare-card rounded-full px-2.5 py-0.5">
                        <Users size={10} strokeWidth={1.75} /> {t('fleet.seats', { n: item.capacity })}
                      </span>
                    )}
                    {item.units?.name && (
                      <span className="inline-flex items-center gap-1 text-xs font-body text-ocean-700 bg-ocean-50 rounded-full px-2.5 py-0.5">
                        <Compass size={10} strokeWidth={1.75} /> {item.units.name}
                      </span>
                    )}
                  </div>

                  {item.next_maintenance_at && (
                    <p className={`text-xs font-mono tabular-nums flex items-center gap-1.5 px-3 py-2 rounded-[14px] border ${manutencaoAtrasada ? 'border-transparent bg-[var(--error-light)] text-[var(--error)]' : 'border-mare-card bg-mare-head text-n-600'}`}>
                      <Wrench size={11} strokeWidth={1.75} />
                      {manutencaoAtrasada
                        ? t('fleet.maintOverdue', { date: dataManutencao })
                        : t('fleet.maintNext', { date: dataManutencao })}
                    </p>
                  )}

                  <div className="flex justify-end gap-1 pt-2 border-t border-mare-card mt-auto">
                    <IconBtn icon={Pencil} label={t('common.edit')} hover={EDIT_HOVER} onClick={() => { setFormError(''); setModal(item); }} />
                    <IconBtn icon={Trash2} label={t('common.delete')} hover={DELETE_HOVER} onClick={() => setDeleteTarget(item)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? t('fleet.newItem') : t('fleet.editTitle', { name: modal?.name })} size="md">
        {modal && <FleetForm item={modal !== 'create' ? modal : null} units={units} onSave={handleSave} onCancel={() => setModal(null)} loading={formLoading} error={formError}/>}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('common.confirm')} size="sm"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={handleDelete}>{t('common.delete')}</Button></>}>
        <p className="text-sm font-body text-n-700">{t('fleet.deleteBefore')}<strong>"{deleteTarget?.name}"</strong>{t('fleet.deleteAfter')}</p>
      </Modal>
    </div>
  );
}
