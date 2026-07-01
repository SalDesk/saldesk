import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Car, Wrench, Package, Users, Compass } from 'lucide-react';
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
      <Input label="Nome" value={form.name} onChange={set('name')} required placeholder="Ex: Kia Sportage, Prancha Kite 12m" />
      <Input label="Matricula" value={form.plate} onChange={set('plate')} placeholder="SL-00-AA" />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Tipo" value={form.type} onChange={set('type')} required>
          <option value="vehicle">Viatura</option>
          <option value="equipment">Equipamento</option>
          <option value="gear">Material</option>
        </Select>
        {item && (
          <Select label="Estado" value={form.status} onChange={set('status')}>
            <option value="available">Disponivel</option>
            <option value="in_use">Em uso</option>
            <option value="maintenance">Manutencao</option>
            <option value="retired">Retirado</option>
          </Select>
        )}
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
      <div className="grid grid-cols-2 gap-3">
        <Input label="Ultima manutencao" type="date" value={form.last_maintenance_at} onChange={set('last_maintenance_at')} />
        <Input label="Proxima manutencao" type="date" value={form.next_maintenance_at} onChange={set('next_maintenance_at')} />
      </div>
      <div>
        <label className="block text-sm font-body font-semibold text-n-700 mb-2">Foto da viatura</label>
        {form.photo && (
          <img src={form.photo} alt="Viatura" className="w-full h-40 object-cover rounded-xl mb-2 border border-n-200" />
        )}
        <input
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
            const manutencaoAtrasada = item.next_maintenance_at && new Date(item.next_maintenance_at) < new Date();
            return (
              <div key={item.id} className="bg-white rounded-xl border border-n-200 shadow-sm overflow-hidden flex flex-col">
                {/* Photo / placeholder */}
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt={item.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-ocean-50 flex items-center justify-center">
                    <Icon size={32} strokeWidth={1.25} className="text-ocean-300" />
                  </div>
                )}

                {/* Body */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-n-900 truncate">{item.name}</p>
                      {item.plate && (
                        <p className="text-xs font-mono text-n-400 mt-0.5">{item.plate}</p>
                      )}
                    </div>
                    <Badge variant={STATUS_BADGE[item.status] || 'default'}>{STATUS_LABELS[item.status]}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.capacity && (
                      <span className="inline-flex items-center gap-1 text-xs font-body text-n-600 bg-n-100 rounded-full px-2.5 py-0.5">
                        <Users size={10} strokeWidth={1.75} /> {item.capacity} lugares
                      </span>
                    )}
                    {item.units?.name && (
                      <span className="inline-flex items-center gap-1 text-xs font-body text-ocean-700 bg-ocean-50 rounded-full px-2.5 py-0.5">
                        <Compass size={10} strokeWidth={1.75} /> {item.units.name}
                      </span>
                    )}
                  </div>

                  {item.next_maintenance_at && (
                    <p className={`text-xs font-body flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${manutencaoAtrasada ? 'bg-red-50 text-error' : 'bg-n-50 text-n-500'}`}>
                      <Wrench size={11} strokeWidth={1.75} />
                      {manutencaoAtrasada ? 'Manutencao atrasada: ' : 'Manutencao: '}
                      {item.next_maintenance_at.split('T')[0]}
                      {manutencaoAtrasada && ' (atrasada)'}
                    </p>
                  )}

                  <div className="flex justify-end gap-1 pt-2 border-t border-n-100 mt-auto">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setFormError(''); setModal(item); }} aria-label="Editar" />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(item)} className="hover:text-error hover:bg-[var(--error-light)]" aria-label="Eliminar" />
                  </div>
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
