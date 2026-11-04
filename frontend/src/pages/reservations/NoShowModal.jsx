import { useState } from 'react';
import { UserX } from 'lucide-react';
import { updateReservation, changeStatus } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
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
        <Textarea label="Nota interna (opcional)" value={note} onChange={e => setNote(e.target.value)}
          rows={2} placeholder="Motivo ou observacao..." />
      </div>
    </Modal>
  );
}
