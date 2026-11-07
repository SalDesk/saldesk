import { useState, useEffect } from 'react';
import { UpgradeModal } from '../components/PlanGuard';
import usePlan from '../hooks/usePlan';
import {
  Plus,
  Briefcase,
  MessageSquare,
  Users,
  CheckSquare,
  Search,
  ClipboardCheck,
} from 'lucide-react';
import { listStaff, createStaff, updateStaff, deleteStaff, createStaffAccount } from '../services/staffService';
import { listSellerCommissions, markCommissionPaid } from '../services/sellerService';
import { getUnreadCount } from '../services/messageService';
import { useToast } from '../store/toastStore';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { ROLES_BY_TYPE, ROLES_DEFAULT, STARTER_STAFF_LIMIT, StaffAvatar } from './staff/shared';
import StaffCard from './staff/StaffCard';
import StaffForm from './staff/StaffForm';
import KanbanBoard from './staff/KanbanBoard';
import ChecklistTab from './staff/ChecklistTab';
import ChatTab from './staff/ChatTab';

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
    { key: 'staff',     label: 'Colaboradores', Icon: Users },
    { key: 'checklist', label: 'Checklist',      Icon: ClipboardCheck },
    { key: 'tasks',     label: 'Tarefas',        Icon: CheckSquare },
    { key: 'chat',      label: 'Chat',           Icon: MessageSquare, badge: unread },
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
        <div className="mb-5 px-4 py-3 rounded-md bg-sand-50 border border-sand-200 text-sm font-body text-sand-700 flex items-center justify-between gap-3">
          <span>Atingiu o limite de {STARTER_STAFF_LIMIT} colaboradores do plano Starter.</span>
          <button onClick={() => setShowUpgrade(true)} className="font-semibold underline shrink-0">
            Fazer upgrade
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-5 bg-n-100 p-1 rounded-md w-fit">
        {TABS.map(({ key, label, Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded text-sm font-display font-medium transition-colors ${tab === key ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
            <Icon size={15} strokeWidth={1.75} />
            {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-xs rounded-full flex items-center justify-center font-mono leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Colaboradores tab */}
      {tab === 'staff' && (
        <div>
          {/* Search */}
          {staffList.length > 3 && (
            <div className="relative mb-4 max-w-xs">
              <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full h-9 pl-8 pr-3 rounded-sm border border-n-200 text-sm font-body bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700"
              />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
          ) : filtered.length === 0 && !search ? (
            <div className="bg-white border border-n-200 rounded-md flex flex-col items-center py-14 text-n-400">
              <Briefcase size={36} strokeWidth={1.25} className="mb-3" />
              <p className="font-body text-sm">Sem colaboradores registados</p>
              <p className="font-body text-xs mt-1 text-center max-w-xs">
                Adicione guias, instrutores e motoristas para atribuir trabalhos
              </p>
            </div>
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
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        return (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-n-200" />
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 px-3">Vendedores de Praia</p>
              <div className="flex-1 h-px bg-n-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sellers.map(s => {
                const comms = listSellerCommissions(s.id);
                const monthComms = typeof comms?.then === 'function' ? [] : comms.filter(c => c.created_at?.startsWith(month));
                const totalMonth   = monthComms.reduce((sum, c) => sum + (c.amount || 0), 0);
                const totalPending = monthComms.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
                return (
                  <div key={s.id} className="bg-white rounded-md border border-sand-200 shadow-sm p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <StaffAvatar member={s} size={40} />
                        <div>
                          <p className="font-display font-semibold text-sm text-n-900">{s.name}</p>
                          <p className="text-xs font-body text-n-500">{s.seller_zone || 'Sem zona definida'}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-sand-300 text-sand-700 rounded-xs uppercase tracking-wide shrink-0">
                        Vendedor
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-n-50 rounded-sm px-2.5 py-2">
                        <p className="font-display font-bold text-sm text-ocean-700">€{Math.round(totalMonth)}</p>
                        <p className="text-[10px] font-body text-n-400">Comissoes mes</p>
                      </div>
                      <div className="bg-yellow-50 rounded-sm px-2.5 py-2">
                        <p className="font-display font-bold text-sm text-yellow-700">€{Math.round(totalPending)}</p>
                        <p className="text-[10px] font-body text-n-400">Por pagar</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-body text-n-500 pt-1 border-t border-n-100">
                      <span>{s.commission_pct || 10}% comissao</span>
                      {totalPending > 0 && (
                        <button
                          onClick={() => {
                            if (!window.confirm(`Registar pagamento de €${Math.round(totalPending)} ao vendedor ${s.name}?`)) return;
                            const comms = listSellerCommissions(s.id);
                            if (typeof comms?.then !== 'function') {
                              comms.filter(c => c.status === 'pending').forEach(c => markCommissionPaid(c.id));
                            }
                          }}
                          className="text-xs font-body font-semibold text-ocean-700 hover:underline">
                          Registar pagamento
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
