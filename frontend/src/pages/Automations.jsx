import { useState, useEffect } from 'react';
import { Plus, Zap } from 'lucide-react';
import { listAutomations, createAutomation, updateAutomation } from '../services/automationsService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import AutomationCard from '../components/automations/AutomationCard';
import AutomationForm from '../components/automations/AutomationForm';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function Automations() {
  const t = useT();
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    listAutomations()
      .then(setAutomations)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(dados) {
    setFormError('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const a = await createAutomation(dados);
        setAutomations([a, ...automations]);
      } else {
        const a = await updateAutomation(modal.id, dados);
        setAutomations(automations.map((x) => (x.id === a.id ? a : x)));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setFormLoading(false);
    }
  }

  function handleUpdate(updated) {
    setAutomations(automations.map((a) => (a.id === updated.id ? updated : a)));
  }

  function handleDelete(id) {
    setAutomations(automations.filter((a) => a.id !== id));
  }

  const activeCount = automations.filter((a) => a.active).length;

  return (
    <div>
      <PageHeader
        title={t('nav.automations')}
        subtitle={`${activeCount} activa(s) de ${automations.length}`}
        actions={
          <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
            Nova automacao
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : automations.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-n-400">
            <Zap size={36} strokeWidth={1.25} className="mb-3" />
            <p className="font-body text-sm mb-1">Sem automacoes configuradas</p>
            <p className="font-body text-xs text-center max-w-xs">
              Crie automacoes para enviar emails e mensagens WhatsApp automaticamente
              na confirmacao, antes do check-in ou apos o checkout.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Info sobre variaveis */}
          <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-4 py-3 mb-5">
            <p className="text-xs font-body text-ocean-700">
              <span className="font-semibold">Variaveis disponiveis nas mensagens:</span>{' '}
              {['{{nome}}', '{{unidade}}', '{{check_in}}', '{{check_out}}', '{{total}}', '{{operador}}'].join(' · ')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {automations.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                onUpdate={handleUpdate}
                onEdit={(auto) => { setFormError(''); setModal(auto); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nova automacao' : `Editar: ${modal?.name}`}
        size="md"
      >
        {modal && (
          <AutomationForm
            automation={modal !== 'create' ? modal : null}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>
    </div>
  );
}
