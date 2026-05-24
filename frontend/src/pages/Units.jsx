import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { listUnits, createUnit, updateUnit, deleteUnit, toggleUnitStatus } from '../services/unitsService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import UnitList from '../components/units/UnitList';
import UnitForm from '../components/units/UnitForm';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function Units() {
  const t = useT();
  const { operator } = useAuthStore();
  const [units,        setUnits]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null); // null | 'create' | unit
  const [formLoading,  setFormLoading]  = useState(false);
  const [formError,    setFormError]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function carregar() {
    try {
      const data = await listUnits();
      setUnits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleSave(dados) {
    setFormError('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const unit = await createUnit(dados);
        setUnits([unit, ...units]);
      } else {
        const unit = await updateUnit(modal.id, dados);
        setUnits(units.map((u) => (u.id === unit.id ? unit : u)));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggle(unit) {
    const next = unit.status === 'inactive' ? 'active' : 'inactive';
    try {
      const updated = await toggleUnitStatus(unit.id, next);
      setUnits(units.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUnit(deleteTarget.id);
      setUnits(units.filter((u) => u.id !== deleteTarget.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  }

  const stats = useMemo(() => ({
    total:    units.length,
    active:   units.filter(u => u.status !== 'inactive').length,
    inactive: units.filter(u => u.status === 'inactive').length,
  }), [units]);

  const modalTitle = modal === 'create'
    ? t('units.new')
    : modal ? `${t('common.edit')}: ${modal.name}` : '';

  return (
    <div>
      <PageHeader
        title={t('units.title')}
        subtitle={`${stats.total} unidade(s) registada(s)`}
        actions={
          <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
            {t('units.new')}
          </Button>
        }
      />

      {/* Stats bar */}
      {!loading && units.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="bg-white rounded-sm border border-n-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-body text-n-500">Total</span>
            <span className="font-display font-bold text-sm text-n-900">{stats.total}</span>
          </div>
          <div className="bg-[#ECFDF5] rounded-sm border border-[#BBF7D0] px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1A7A4A]" />
            <span className="text-xs font-body text-[#1A7A4A]">Activas</span>
            <span className="font-display font-bold text-sm text-[#1A7A4A]">{stats.active}</span>
          </div>
          {stats.inactive > 0 && (
            <div className="bg-n-50 rounded-sm border border-n-200 px-4 py-2.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-n-300" />
              <span className="text-xs font-body text-n-500">Inactivas</span>
              <span className="font-display font-bold text-sm text-n-500">{stats.inactive}</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <UnitList
          units={units}
          onEdit={(unit) => { setFormError(''); setModal(unit); }}
          onDelete={setDeleteTarget}
          onToggle={handleToggle}
        />
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modalTitle}
        size="md"
        footer={null}
      >
        {modal && (
          <UnitForm
            unit={modal !== 'create' ? modal : null}
            operatorType={operator?.operator_type}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('common.confirm')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm font-body text-n-700">
          Eliminar a unidade <strong>"{deleteTarget?.name}"</strong>?
          As reservas associadas serao mantidas mas a unidade ficara indisponivel.
        </p>
      </Modal>
    </div>
  );
}
