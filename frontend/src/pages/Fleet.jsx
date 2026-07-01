import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Car, Wrench, Package, Users } from 'lucide-react';
import { listFleet, createFleet, updateFleet, deleteFleet } from '../services/fleetService';
import { listUnits } from '../services/unitsService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Input, { Select, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const TYPE_ICONS = { vehicle: Car, equipment: Wrench, gear: Package };
const TYPE_LABELS = { vehicle: 'Viatura', equipment: 'Equipamento', gear: 'Material' };
const STATUS_BADGE = { available: 'confirmed', in_use: 'pending', maintenance: 'warning', retired: 'cancelled' };
const STATUS_LABELS = { available: 'Disponivel', in_use: 'Em uso', maintenance: 'Manutencao', retired: 'Retirado' };

function FleetForm({ item, units, onSave, onCancel, loading, error }) {
  const [form, setForm] = useState({
    name: item?.name || '', type: item?.type || 'vehicle',
    description: item?.description || '', notes: item?.notes || '',
    status: item?.status || 'available',
    next_maintenance_at: item?.next_maintenance_at?.split('T')[0] || '',
    capacity: item?.capacity || 2,
    unit_id: item?.unit_id || '',
  });
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, unit_id: form.unit_id || null }); }} className="space-y-4">
      <Input label="Nome" value={form.name} onChange={set('name')} required placeholder="Ex: Kia Sportage, Prancha Kite 12m" />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Tipo" value={form.type} onChange={set('type')} required>
          <option value="vehicle">Viatura</option>
          <option value="equipment">Equipamento</option>
          <option value="gear">Material</option>
        </Select>
        {item && <Select label="Estado" value={form.status} onChange={set('status')}>
          <option value="available">Disponivel</option>
          <option value="in_use">Em uso</option>
          <option value="maintenance">Manutencao</option>
          <option value="retired">Retirado</option>
        </Select>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Capacidade (lugares)" value={form.capacity} onChange={(e) => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}>
          <option value={2}>2 lugares</option>
          <option value={4}>4 lugares</option>
          <option value={6}>6 lugares</option>
          <option value={8}>8 lugares</option>
          <option value={10}>10 lugares</option>
          <option value={12}>12 lugares</option>
        </Select>
        <Select label="Tour associado" value={form.unit_id} onChange={set('unit_id')}>
          <option value="">Nenhum (generico)</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>
      <Textarea label="Descricao" value={form.description} onChange={set('description')} rows={2} />
      <Input label="Proxima manutencao" type="date" value={form.next_maintenance_at} onChange={set('next_maintenance_at')} />
      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">{item ? 'Guardar' : 'Criar item'}</Button>
      </div>
    </form>
  );
}

export default function Fleet() {
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
      setFormError(err.response?.data?.error || 'Erro ao guardar');
    } finally { setFormLoading(false); }
  }

  async function handleDelete() {
    try {
      await deleteFleet(deleteTarget.id);
      setItems(items.filter((i) => i.id !== deleteTarget.id));
    } finally { setDeleteTarget(null); }
  }

  const available = items.filter((i) => i.status === 'available').length;

  return (
    <div>
      <PageHeader title="Frota e Equipamento" subtitle={`${available} disponivel(is) de ${items.length}`}
        actions={<Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>Novo item</Button>} />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : items.length === 0 ? (
        <Card><div className="flex flex-col items-center py-10 text-n-400"><Car size={36} strokeWidth={1.25} className="mb-3"/><p className="font-body text-sm">Sem itens de frota registados</p></div></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || Package;
            return (
              <div key={item.id} className="bg-white rounded-md border border-n-200 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
                      <Icon size={18} strokeWidth={1.75} className="text-ocean-700"/>
                    </div>
                    <div>
                      <p className="font-display font-semibold text-sm text-n-900">{item.name}</p>
                      <p className="text-xs font-body text-n-500">{TYPE_LABELS[item.type]}</p>
                    </div>
                  </div>
                  <Badge variant={STATUS_BADGE[item.status] || 'default'}>{STATUS_LABELS[item.status]}</Badge>
                </div>
                {item.description && <p className="text-xs font-body text-n-600 line-clamp-2">{item.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {item.capacity && (
                    <span className="inline-flex items-center gap-1 text-xs font-body text-n-600 bg-n-100 rounded-sm px-2 py-0.5">
                      <Users size={10} strokeWidth={1.75}/> {item.capacity} lugares
                    </span>
                  )}
                  {item.units?.name && (
                    <span className="inline-flex items-center gap-1 text-xs font-body text-ocean-700 bg-ocean-50 rounded-sm px-2 py-0.5">
                      {item.units.name}
                    </span>
                  )}
                </div>
                {item.next_maintenance_at && (
                  <p className="text-xs font-body text-n-500 flex items-center gap-1">
                    <Wrench size={11} strokeWidth={1.75}/> Manutencao: {item.next_maintenance_at.split('T')[0]}
                  </p>
                )}
                <div className="flex justify-end gap-1 pt-2 border-t border-n-100">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setFormError(''); setModal(item); }} aria-label="Editar"/>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(item)} className="hover:text-error hover:bg-[var(--error-light)]" aria-label="Eliminar"/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Novo item' : `Editar: ${modal?.name}`} size="md">
        {modal && <FleetForm item={modal !== 'create' ? modal : null} units={units} onSave={handleSave} onCancel={() => setModal(null)} loading={formLoading} error={formError}/>}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar" size="sm"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="danger" onClick={handleDelete}>Eliminar</Button></>}>
        <p className="text-sm font-body text-n-700">Eliminar <strong>"{deleteTarget?.name}"</strong>?</p>
      </Modal>
    </div>
  );
}
