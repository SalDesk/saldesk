import { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { updateReservation } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

export default function RescheduleModal({ reservation, open, onClose, onDone }) {
  const [newDate,  setNewDate]  = useState(reservation?.check_in || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { if (reservation) setNewDate(reservation.check_in || ''); }, [reservation]);

  async function handleSave() {
    if (!newDate || !reservation) return;
    setSaving(true); setError('');
    try {
      await updateReservation(reservation.id, { check_in: newDate });
      onDone(newDate);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao reagendar');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reagendar reserva" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={handleSave} icon={CalendarDays}>Reagendar</Button>
        </>
      }>
      <div className="space-y-3">
        <p className="text-sm font-body text-n-700">
          Reserva de <strong>{reservation?.customer_name}</strong>
        </p>
        <Input label="Nova data" type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
        {error && <p className="text-xs font-body text-error">{error}</p>}
      </div>
    </Modal>
  );
}
