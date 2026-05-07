import { useState } from 'react';
import { Mail, MessageCircle, Pencil, Trash2, Zap } from 'lucide-react';
import { toggleAutomation, deleteAutomation } from '../../services/automationsService';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const TRIGGER_LABELS = {
  booking_confirmed:   'Confirmacao de reserva',
  checkin_reminder:    'Lembrete check-in',
  checkout_thanks:     'Agradecimento pos checkout',
  days_before_checkin: (d) => `${d} dias antes do check-in`,
  days_after_checkout: (d) => `${d} dias apos checkout`,
};

function getTriggerLabel(auto) {
  const fn = TRIGGER_LABELS[auto.trigger_type];
  if (!fn) return auto.trigger_type;
  return typeof fn === 'function' ? fn(auto.trigger_days) : fn;
}

export default function AutomationCard({ automation, onUpdate, onEdit, onDelete }) {
  const t = useT();
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      const updated = await toggleAutomation(automation.id, !automation.active);
      onUpdate(updated);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteAutomation(automation.id);
      onDelete(automation.id);
    } finally {
      setConfirmDelete(false);
    }
  }

  const ChannelIcon = automation.channel === 'email' ? Mail : MessageCircle;

  return (
    <>
      <div className={`bg-white rounded-md border shadow-sm p-4 flex flex-col gap-3 transition-opacity ${automation.active ? 'border-n-200' : 'border-n-100 opacity-60'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ChannelIcon size={14} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
              <p className="font-display font-semibold text-sm text-n-900 truncate">{automation.name}</p>
            </div>
            <p className="text-xs font-body text-n-500">{getTriggerLabel(automation)}</p>
          </div>
          {/* Toggle activo */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${automation.active ? 'bg-ocean-700' : 'bg-n-300'}`}
            aria-label="Toggle automacao"
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${automation.active ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {automation.subject && (
          <p className="text-xs font-body text-n-600 bg-n-50 rounded-xs px-2 py-1 truncate">
            Assunto: {automation.subject}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-n-100">
          <Badge variant={automation.active ? 'confirmed' : 'default'}>
            {automation.active ? 'Activa' : 'Inactiva'}
          </Badge>
          <Badge variant="info">{automation.channel === 'email' ? 'Email' : 'WhatsApp'}</Badge>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(automation)} aria-label="Editar" />
            <Button
              variant="ghost" size="sm" icon={Trash2}
              onClick={() => setConfirmDelete(true)}
              className="hover:text-error hover:bg-[var(--error-light)]"
              aria-label="Eliminar"
            />
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('common.confirm')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete}>{t('common.delete')}</Button>
          </>
        }
      >
        <p className="text-sm font-body text-n-700">
          Eliminar a automacao <strong>"{automation.name}"</strong>? Esta accao nao pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}
