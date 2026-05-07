import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { listUnits, createUnit, updateUnit, deleteUnit } from '../services/unitsService';
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
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | unit
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
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

  const modalTitle = modal === 'create'
    ? t('units.new')
    : modal ? `${t('common.edit')}: ${modal.name}` : '';

  return (
    <div>
      <PageHeader
        title={t('units.title')}
        subtitle={`${units.length} unidade(s) registada(s)`}
        actions={
          <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
            {t('units.new')}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <UnitList
          units={units}
          onEdit={(unit) => { setFormError(''); setModal(unit); }}
          onDelete={setDeleteTarget}
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
