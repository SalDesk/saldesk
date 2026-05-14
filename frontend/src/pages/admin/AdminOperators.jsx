import { useState, useEffect } from 'react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const PLAN_BADGE   = { starter:'info', business:'pending', pro:'confirmed' };
const STATUS_BADGE = { trial:'pending', active:'confirmed', suspended:'cancelled', cancelled:'cancelled' };

export default function AdminOperators() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm]   = useState({ plan: '', plan_status: '' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    api.get('/admin/operators', { params: { search } }).then(r => setOperators(r.data.data)).finally(() => setLoading(false));
  }, [search]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/operators/${editModal.id}/status`, editForm);
      setOperators(operators.map(o => o.id === editModal.id ? { ...o, ...data.data } : o));
      setEditModal(null);
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'name',         label: 'Operador',   render: o => <span className="font-semibold text-n-900">{o.name}</span> },
    { key: 'operator_type',label: 'Tipo',       render: o => <span className="text-n-600 text-xs">{o.operator_type}</span>, width:'90px' },
    { key: 'plan',         label: 'Plano',      render: o => <Badge variant={PLAN_BADGE[o.plan]||'default'}>{o.plan}</Badge>, width:'90px' },
    { key: 'plan_status',  label: 'Estado',     render: o => <Badge variant={STATUS_BADGE[o.plan_status]||'default'}>{o.plan_status}</Badge>, width:'90px' },
    { key: 'trial_ends_at',label: 'Trial ate',  render: o => o.trial_ends_at ? o.trial_ends_at.split('T')[0] : '—', width:'110px' },
    { key: 'actions',      label: '',           render: o => <Button variant="ghost" size="sm" onClick={() => { setEditForm({ plan: o.plan, plan_status: o.plan_status }); setEditModal(o); }}>Editar</Button>, width:'80px' },
  ];

  return (
    <div>
      <PageHeader title="Operadores" subtitle={`${operators.length} registados`}/>
      <div className="mb-4 max-w-sm">
        <Input placeholder="Pesquisar por nome..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <Card padding="p-0">
        <Table columns={columns} rows={operators} loading={loading}/>
      </Card>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Editar: ${editModal?.name}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditModal(null)}>Cancelar</Button><Button loading={saving} onClick={handleSave}>Guardar</Button></>}>
        <div className="space-y-4">
          <Select label="Plano" value={editForm.plan} onChange={e => setEditForm({...editForm, plan: e.target.value})}>
            <option value="starter">Starter</option>
            <option value="business">Business</option>
            <option value="pro">Pro</option>
          </Select>
          <Select label="Estado" value={editForm.plan_status} onChange={e => setEditForm({...editForm, plan_status: e.target.value})}>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}
