import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect } from 'react';
import UnitList from '../components/units/UnitList';
import UnitForm from '../components/units/UnitForm';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { listUnits, createUnit, updateUnit, deleteUnit } from '../services/unitsService';
import useAuthStore from '../store/authStore';
import { useToast } from '../store/toastStore';

export default function Units() {
  usePageTitle('Unidades');
  const { token, operator } = useAuthStore();
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // unit a eliminar
  const [formLoading, setFormLoading] = useState(false);
  const [formErro, setFormErro] = useState('');

  async function carregar() {
    try {
      const { data } = await listUnits(token);
      setUnits(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleSave(dados) {
    setFormErro('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const { data } = await createUnit(token, dados);
        setUnits([data, ...units]);
        toast.success('Unidade criada com sucesso');
      } else {
        const { data } = await updateUnit(token, modal.unit.id, dados);
        setUnits(units.map((u) => (u.id === data.id ? data : u)));
        toast.success('Unidade actualizada');
      }
      setModal(null);
    } catch (err) {
      setFormErro(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteUnit(token, confirmDelete.id);
      setUnits(units.filter((u) => u.id !== confirmDelete.id));
      toast.success(`"${confirmDelete.name}" eliminada`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
          <p className="text-gray-500 text-sm mt-1">{units.length} unidade(s) registada(s)</p>
        </div>
        <button onClick={() => { setFormErro(''); setModal('create'); }} className="btn-primary">
          + Nova Unidade
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">A carregar...</div>
      ) : (
        <UnitList
          units={units}
          onEdit={(unit) => { setFormErro(''); setModal({ unit }); }}
          onDelete={(unit) => setConfirmDelete(unit)}
        />
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {modal === 'create' ? 'Nova Unidade' : `Editar: ${modal.unit.name}`}
            </h2>
            <UnitForm
              unit={modal !== 'create' ? modal.unit : null}
              operatorType={operator?.operator_type}
              onSave={handleSave}
              onCancel={() => setModal(null)}
              loading={formLoading}
              erro={formErro}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          mensagem={`Eliminar a unidade "${confirmDelete.name}"? As reservas associadas serão mantidas, mas a unidade ficará indisponível.`}
          onConfirmar={handleDelete}
          onCancelar={() => setConfirmDelete(null)}
          labelConfirmar="Eliminar"
        />
      )}
    </div>
  );
}
