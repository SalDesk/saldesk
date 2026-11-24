import { useState } from 'react';
import { UserX } from 'lucide-react';
import { updateReservation, changeStatus } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useT } from '../../i18n';
import { TextoComNome } from './shared';

export default function NoShowModal({ reservation, open, onClose, onDone }) {
  const t = useT();
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
    <Modal open={open} onClose={onClose} title={t('reservations.noShow.title')} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={saving} onClick={handleConfirm} icon={UserX}>{t('reservations.noShow.confirm')}</Button>
        </>
      }>
      <div className="space-y-3">
        <p className="text-sm font-body text-n-700">
          <TextoComNome chave="reservations.noShow.mark" nome={reservation?.customer_name} />
        </p>
        <Textarea label={t('reservations.noShow.noteLabel')} value={note} onChange={e => setNote(e.target.value)}
          rows={2} placeholder={t('reservations.noShow.notePlaceholder')} />
      </div>
    </Modal>
  );
}
