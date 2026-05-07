import { useState } from 'react';
import { updateAutomation, deleteAutomation } from '../../services/automationsService';
import useAuthStore from '../../store/authStore';
import { useToast } from '../../store/toastStore';
import ConfirmDialog from '../ui/ConfirmDialog';

const TRIGGER_LABEL = {
  booking_confirmed:   { label: 'Reserva confirmada', color: 'bg-blue-100 text-blue-700' },
  checkin_reminder:    { label: 'Lembrete check-in',  color: 'bg-yellow-100 text-yellow-700' },
  checkout_thanks:     { label: 'Agradec. checkout',  color: 'bg-green-100 text-green-700' },
  days_before_checkin: { label: 'X dias antes',       color: 'bg-purple-100 text-purple-700' },
  days_after_checkout: { label: 'X dias depois',      color: 'bg-orange-100 text-orange-700' }
};

export default function AutomationCard({ automation, onUpdate, onEdit, onDelete }) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trigger = TRIGGER_LABEL[automation.trigger_type] || { label: automation.trigger_type, color: 'bg-gray-100 text-gray-600' };

  async function handleToggle() {
    try {
      const { data } = await updateAutomation(token, automation.id, { active: !automation.active });
      onUpdate(data);
      toast.success(data.active ? 'Automação activada' : 'Automação desactivada');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    try {
      await deleteAutomation(token, automation.id);
      onDelete(automation.id);
      toast.success('Automação eliminada');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <div className={`card border-l-4 ${automation.active ? 'border-l-green-400' : 'border-l-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{automation.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trigger.color}`}>
              {trigger.label}
              {automation.trigger_days ? ` (${automation.trigger_days}d)` : ''}
            </span>
            <span className="text-xs text-gray-400">
              {automation.channel === 'email' ? '✉️ Email' : '💬 WhatsApp'}
            </span>
          </div>
        </div>

        {/* Toggle activo */}
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            automation.active ? 'bg-green-500' : 'bg-gray-200'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            automation.active ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {automation.subject && (
        <p className="text-xs text-gray-500 mb-2 truncate">Assunto: {automation.subject}</p>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button onClick={() => onEdit(automation)} className="btn-secondary text-xs py-1 px-3 flex-1">
          Editar
        </button>
        <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 px-3 py-1 underline">
          Eliminar
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          mensagem={`Eliminar a automação "${automation.name}"?`}
          onConfirmar={handleDelete}
          onCancelar={() => setConfirmDelete(false)}
          labelConfirmar="Eliminar"
        />
      )}
    </div>
  );
}
