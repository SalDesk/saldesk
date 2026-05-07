import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect } from 'react';
import AutomationCard from '../components/automations/AutomationCard';
import AutomationForm from '../components/automations/AutomationForm';
import { listAutomations, createAutomation, updateAutomation } from '../services/automationsService';
import useAuthStore from '../store/authStore';

export default function Automations() {
  usePageTitle('Automações');
  const token = useAuthStore((s) => s.token);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | { automation }
  const [formLoading, setFormLoading] = useState(false);
  const [formErro, setFormErro] = useState('');

  useEffect(() => {
    listAutomations(token)
      .then(({ data }) => setAutomations(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(dados) {
    setFormErro('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const { data } = await createAutomation(token, dados);
        setAutomations([data, ...automations]);
      } else {
        const { data } = await updateAutomation(token, modal.automation.id, dados);
        setAutomations(automations.map((a) => (a.id === data.id ? data : a)));
      }
      setModal(null);
    } catch (err) {
      setFormErro(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  const activas = automations.filter((a) => a.active).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activas} activa(s) de {automations.length} total
          </p>
        </div>
        <button onClick={() => { setFormErro(''); setModal('create'); }} className="btn-primary">
          + Nova Automação
        </button>
      </div>

      {/* Informação sobre variáveis */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
        <p className="font-semibold mb-1">ℹ️ Como funcionam as automações</p>
        <p>O sistema verifica automaticamente a cada hora quais as reservas que satisfazem cada gatilho e envia a mensagem se ainda não foi enviada. O idioma é detectado automaticamente pelo país do cliente.</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">A carregar...</div>
      ) : automations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🤖</div>
          <p className="font-medium">Sem automações</p>
          <p className="text-sm mt-1">Crie a sua primeira automação para comunicar com os clientes automaticamente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {automations.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onUpdate={(updated) => setAutomations(automations.map((x) => (x.id === updated.id ? updated : x)))}
              onEdit={(auto) => { setFormErro(''); setModal({ automation: auto }); }}
              onDelete={(id) => setAutomations(automations.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {modal === 'create' ? 'Nova Automação' : `Editar: ${modal.automation.name}`}
            </h2>
            <AutomationForm
              automation={modal !== 'create' ? modal.automation : null}
              onSave={handleSave}
              onCancel={() => setModal(null)}
              loading={formLoading}
              erro={formErro}
            />
          </div>
        </div>
      )}
    </div>
  );
}
