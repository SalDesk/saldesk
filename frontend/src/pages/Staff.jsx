import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Star, Briefcase, Phone, Mail } from 'lucide-react';
import { listStaff, createStaff, updateStaff, deleteStaff } from '../services/staffService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Input, { Select } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const ROLES = ['Instrutor', 'Guia', 'Motorista', 'Assistente', 'Recepcao', 'Outro'];

function StaffForm({ member, onSave, onCancel, loading, error }) {
  const [form, setForm] = useState({
    name: member?.name || '', role: member?.role || ROLES[0],
    phone: member?.phone || '', email: member?.email || '', whatsapp: member?.whatsapp || '',
    status: member?.status || 'active',
  });
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Input label="Nome" value={form.name} onChange={set('name')} required placeholder="Nome do colaborador" />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Cargo" value={form.role} onChange={set('role')} required>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        {member && <Select label="Estado" value={form.status} onChange={set('status')}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </Select>}
      </div>
      <Input label="Telefone" value={form.phone} onChange={set('phone')} type="tel" placeholder="+238 900 0000" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="nome@email.com" />
        <Input label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} type="tel" placeholder="+238 900 0000" />
      </div>
      {error && <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">{member ? 'Guardar' : 'Criar colaborador'}</Button>
      </div>
    </form>
  );
}

export default function Staff() {
  const t = useT();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    listStaff().then(setStaff).finally(() => setLoading(false));
  }, []);

  async function handleSave(dados) {
    setFormError(''); setFormLoading(true);
    try {
      if (modal === 'create') {
        const m = await createStaff(dados);
        setStaff([m, ...staff]);
      } else {
        const m = await updateStaff(modal.id, dados);
        setStaff(staff.map((s) => (s.id === m.id ? m : s)));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || t('errors.generic'));
    } finally { setFormLoading(false); }
  }

  async function handleDelete() {
    try {
      await deleteStaff(deleteTarget.id);
      setStaff(staff.filter((s) => s.id !== deleteTarget.id));
    } finally { setDeleteTarget(null); }
  }

  const active = staff.filter((s) => s.status === 'active').length;

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle={`${active} activo(s) de ${staff.length}`}
        actions={<Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>Novo colaborador</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : staff.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-n-400">
            <Briefcase size={36} strokeWidth={1.25} className="mb-3" />
            <p className="font-body text-sm">Sem colaboradores registados</p>
            <p className="font-body text-xs mt-1 text-center max-w-xs">Adicione guias, instrutores e motoristas para atribuir trabalhos</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((m) => (
            <div key={m.id} className="bg-white rounded-md border border-n-200 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ocean-700 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
                    {m.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-n-900">{m.name}</p>
                    <p className="text-xs font-body text-n-500">{m.role}</p>
                  </div>
                </div>
                <Badge variant={m.status === 'active' ? 'confirmed' : 'cancelled'}>
                  {m.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="space-y-1">
                {m.phone && <p className="text-xs font-body text-n-600 flex items-center gap-1.5"><Phone size={11} strokeWidth={1.75} className="text-n-400"/>{m.phone}</p>}
                {m.email && <p className="text-xs font-body text-n-600 flex items-center gap-1.5"><Mail size={11} strokeWidth={1.75} className="text-n-400"/>{m.email}</p>}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-n-100">
                <div className="flex items-center gap-3 text-xs font-body text-n-500">
                  <span className="flex items-center gap-1"><Briefcase size={11} strokeWidth={1.75}/>{m.total_jobs_completed} trabalhos</span>
                  {m.average_rating > 0 && <span className="flex items-center gap-1"><Star size={11} strokeWidth={1.75} className="text-sand-500"/>{Number(m.average_rating).toFixed(1)}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setFormError(''); setModal(m); }} aria-label="Editar"/>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(m)} className="hover:text-error hover:bg-[var(--error-light)]" aria-label="Eliminar"/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Novo colaborador' : `Editar: ${modal?.name}`} size="md">
        {modal && <StaffForm member={modal !== 'create' ? modal : null} onSave={handleSave} onCancel={() => setModal(null)} loading={formLoading} error={formError}/>}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar" size="sm"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="danger" onClick={handleDelete}>Eliminar</Button></>}>
        <p className="text-sm font-body text-n-700">Eliminar o colaborador <strong>"{deleteTarget?.name}"</strong>? Esta accao nao pode ser desfeita.</p>
      </Modal>
    </div>
  );
}
