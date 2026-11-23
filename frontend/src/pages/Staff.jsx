import { useState, useEffect } from 'react';
import { UpgradeModal } from '../components/PlanGuard';
import usePlan from '../hooks/usePlan';
import {
  Plus,
  Briefcase,
} from 'lucide-react';
import { listStaff, createStaff, updateStaff, deleteStaff, createStaffAccount } from '../services/staffService';
import { getUnreadCount } from '../services/messageService';
import { useToast } from '../store/toastStore';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { ROLES_BY_TYPE, ROLES_DEFAULT, STARTER_STAFF_LIMIT, CARGO_VENDEDOR, rotuloCargo } from './staff/shared';
import { useLingua } from '../utils/formatoLingua';
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
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';

/* ── Main Staff Page ── */
export default function Staff() {
  const t = useT();
  const lang = useLingua();
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
      toast.success(t('staff.toast.accountCreated'));
    } catch (err) {
      toast.error(mensagemErro(err, t, t('staff.errors.createAccount')));
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
            toast.success(t('staff.toast.createdWithAccount'));
          } catch {
            toast.error(t('staff.toast.accountFailed'));
          }
        }
        setStaffList(p => [m, ...p]);
      } else {
        const m = await updateStaff(modal.id, dados);
        setStaffList(p => p.map(s => s.id === m.id ? m : s));
      }
      setModal(null);
    } catch (err) {
      setFormError(mensagemErro(err, t, t('staff.errors.save')));
    } finally { setFormLoad(false); }
  }

  async function handleDelete() {
    try {
      await deleteStaff(deleteTarget.id);
      setStaffList(p => p.filter(s => s.id !== deleteTarget.id));
    } finally { setDelTarget(null); }
  }

  const active    = staffList.filter(s => s.status === 'active').length;
  /* o cargo procura-se pelo valor gravado e pelo rotulo na lingua do painel */
  const q = search.toLowerCase();
  const filtered  = search
    ? staffList.filter(s => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q)
      || String(rotuloCargo(s.role, t, lang) || '').toLowerCase().includes(q))
    : staffList;

  const TABS = [
    { id: 'staff',     label: t('staff.tabs.staff') },
    { id: 'checklist', label: t('staff.tabs.checklist') },
    { id: 'tasks',     label: t('staff.tabs.tasks') },
    { id: 'chat',      label: t('staff.tabs.chat'), count: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined },
  ];

  return (
    <div>
      <PageHeader
        title={t('staff.title')}
        subtitle={
          plan === 'starter'
            ? t('staff.subtitleStarter', { active, n: staffList.length, limit: STARTER_STAFF_LIMIT })
            : t('staff.subtitle', { active, n: staffList.length })
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
              {t('staff.newStaff')}
            </Button>
          )
        }
      />

      {atStarterLimit && (
        <div className="mb-5 px-4 py-3 rounded-sm bg-[var(--sand-50)] border border-[var(--sand-300)] text-sm font-body text-n-800 flex items-center justify-between gap-3">
          <span>{t('staff.limitReached', { limit: STARTER_STAFF_LIMIT })}</span>
          <button onClick={() => setShowUpgrade(true)} className="font-semibold underline shrink-0">
            {t('staff.upgrade')}
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
              <Input aria-label={t('staff.searchLabel')} value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('staff.searchPlaceholder')} />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
          ) : filtered.length === 0 && !search ? (
            <Card padding="p-0">
              <EmptyState icon={Briefcase} title={t('staff.emptyTitle')}
                description={t('staff.emptyDesc')} />
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
        const sellers = staffList.filter(s => s.role === CARGO_VENDEDOR);
        if (sellers.length === 0) return null;
        return (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-n-200" />
              <p className="text-xs font-mono uppercase tracking-wider text-n-500 px-3">{t('staff.sellersTitle')}</p>
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
        title={modal === 'create' ? t('staff.newStaff') : t('staff.editTitle', { name: modal?.name })}
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
      <Modal open={!!deleteTarget} onClose={() => setDelTarget(null)} title={t('common.confirm')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDelTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete}>{t('common.delete')}</Button>
          </>
        }>
        <p className="text-sm font-body text-n-700">
          {t('staff.deleteBefore')}<strong>"{deleteTarget?.name}"</strong>{t('staff.deleteAfter')}
        </p>
      </Modal>

      {showUpgrade && (
        <UpgradeModal plan="pro" feature="colaboradores" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
