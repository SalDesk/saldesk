import { useState } from 'react';
import { UserX } from 'lucide-react';
import { updateReservation, changeStatus } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

export default function NoShowModal({ reservation, open, onClose, onDone }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await changeStatus(reservation.id, 'no_show');
      if (note.trim()) {
        await updateReservation(reservation.id, { notes_internal: note });
      }
      onDone();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registar No-Show" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" loading={saving} onClick={handleConfirm} icon={UserX}>Confirmar No-Show</Button>
        </>
      }>
      <div className="space-y-3">
        <p className="text-sm font-body text-n-700">
          Marcar <strong>{reservation?.customer_name}</strong> como no-show?
        </p>
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">Nota interna (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={2} placeholder="Motivo ou observacao..."
            className="w-full px-3 py-2 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white resize-none" />
        </div>
      </div>
    </Modal>
  );
}
