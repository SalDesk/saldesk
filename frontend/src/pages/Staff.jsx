import { useState, useEffect } from 'react';
import { UpgradeModal } from '../components/PlanGuard';
import usePlan from '../hooks/usePlan';
import {
  Plus,
  Briefcase,
  Search,
} from 'lucide-react';
import { listStaff, createStaff, updateStaff, deleteStaff, createStaffAccount } from '../services/staffService';
import { getUnreadCount } from '../services/messageService';
import { useToast } from '../store/toastStore';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { ROLES_BY_TYPE, ROLES_DEFAULT, STARTER_STAFF_LIMIT } from './staff/shared';
import StaffCard from './staff/StaffCard';
import SellerCard from './staff/SellerCard';
import StaffForm from './staff/StaffForm';
import KanbanBoard from './staff/KanbanBoard';
import ChecklistTab from './staff/ChecklistTab';
import ChatTab from './staff/ChatTab';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';

/* ── Main Staff Page ── */
export default function Staff() {
  const { operator } = useAuthStore();
  const ROLES = ROLES_BY_TYPE[operator?.operator_type] || ROLES_DEFAULT;
  const { plan } = usePlan();

  const [tab, setTab]               = useState('staff');
  const [staffList, setStaffList]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [formLoading, setFormLoad]  = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteTarget, setDelTarget]= useState(null);
  const [unread, setUnread]         = useState(0);
  const [search, setSearch]         = useState('');
  const [accountCreatingId, setAccountCreatingId] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const toast = useToast();

  const atStarterLimit = plan === 'starter' && staffList.length >= STARTER_STAFF_LIMIT;

  useEffect(() => {
    listStaff().then(setStaffList).finally(() => setLoading(false));
    getUnreadCount().then(setUnread).catch(() => {});
  }, []);

  async function handleCreateAccount(member) {
    setAccountCreatingId(member.id);
    try {
      const acc = await createStaffAccount(member.id);
      setStaffList(p => p.map(s => s.id === member.id ? { ...s, user_id: acc.user_id } : s));
      toast.success('Conta criada e email enviado ao colaborador');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setAccountCreatingId(null);
    }
  }

  async function handleSave(dados) {
    if (modal === 'create' && plan === 'starter' && staffList.length >= STARTER_STAFF_LIMIT) {
      setModal(null);
      setShowUpgrade(true);
      return;
    }
    setFormError(''); setFormLoad(true);
    try {
      if (modal === 'create') {
        const m = await createStaff(dados);
        if (dados.create_access && m.email) {
          try {
            const acc = await createStaffAccount(m.id);
            m.user_id = acc.user_id;
            toast.success('Colaborador criado e conta de acesso enviada por email');
          } catch {
            toast.error('Colaborador criado, mas a conta de acesso falhou — tente novamente no cartao do colaborador');
          }
        }
        setStaffList(p => [m, ...p]);
      } else {
        const m = await updateStaff(modal.id, dados);
        setStaffList(p => p.map(s => s.id === m.id ? m : s));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao guardar');
    } finally { setFormLoad(false); }
  }

  async function handleDelete() {
    try {
      await deleteStaff(deleteTarget.id);
      setStaffList(p => p.filter(s => s.id !== deleteTarget.id));
    } finally { setDelTarget(null); }
  }

  const active    = staffList.filter(s => s.status === 'active').length;
  const filtered  = search
    ? staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase()))
    : staffList;

  const TABS = [
    { id: 'staff',     label: 'Colaboradores' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'tasks',     label: 'Tarefas' },
    { id: 'chat',      label: 'Chat', count: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined },
  ];

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle={
          plan === 'starter'
            ? `${active} activo(s) · ${staffList.length}/${STARTER_STAFF_LIMIT} no plano Starter`
            : `${active} activo(s) · ${staffList.length} total`
        }
        actions={
          tab === 'staff' && (
            <Button
              icon={Plus}
              onClick={() => {
                if (atStarterLimit) { setShowUpgrade(true); return; }
                setFormError(''); setModal('create');
              }}
            >
              Novo colaborador
            </Button>
          )
        }
      />

      {atStarterLimit && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-[var(--sand-50)] border border-[var(--sand-300)] text-sm font-body text-n-800 flex items-center justify-between gap-3">
          <span>Atingiu o limite de {STARTER_STAFF_LIMIT} colaboradores do plano Starter.</span>
          <button onClick={() => setShowUpgrade(true)} className="font-semibold underline shrink-0">
            Fazer upgrade
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-5">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {/* Colaboradores tab */}
      {tab === 'staff' && (
        <div>
          {/* Search */}
          {staffList.length > 3 && (
            <div className="mb-4 max-w-xs">
              <Input aria-label="Pesquisar colaboradores" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar..." />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
          ) : filtered.length === 0 && !search ? (
            <Card padding="p-0">
              <EmptyState icon={Briefcase} title="Sem colaboradores registados"
                description="Adicione guias, instrutores e motoristas para atribuir trabalhos" />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(m => (
                <StaffCard key={m.id} member={m}
                  onEdit={m => { setFormError(''); setModal(m); }}
                  onDelete={setDelTarget}
                  onCreateAccount={handleCreateAccount}
                  creatingAccountId={accountCreatingId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vendedores de Praia section */}
      {tab === 'staff' && (() => {
        const sellers = staffList.filter(s => s.role === 'Vendedor de Praia');
        if (sellers.length === 0) return null;
        return (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-n-200" />
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 px-3">Vendedores de Praia</p>
              <div className="flex-1 h-px bg-n-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sellers.map(s => <SellerCard key={s.id} seller={s} />)}
            </div>
          </div>
        );
      })()}

      {/* Checklist tab */}
      {tab === 'checklist' && <ChecklistTab />}

      {/* Tarefas tab */}
      {tab === 'tasks' && <KanbanBoard staffList={staffList} />}

      {/* Chat tab */}
      {tab === 'chat' && <ChatTab staffList={staffList} />}

      {/* Create / Edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo colaborador' : `Editar: ${modal?.name}`}
        size="md">
        {modal && (
          <StaffForm
            member={modal !== 'create' ? modal : null}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
            roles={ROLES}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDelTarget(null)} title="Confirmar" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDelTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </>
        }>
        <p className="text-sm font-body text-n-700">
          Eliminar o colaborador <strong>"{deleteTarget?.name}"</strong>? Esta accao nao pode ser desfeita.
        </p>
      </Modal>

      {showUpgrade && (
        <UpgradeModal plan="pro" feature="colaboradores" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
