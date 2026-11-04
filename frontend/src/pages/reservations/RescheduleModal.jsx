import { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { updateReservation } from '../../services/reservationsService';
import Button from '../../components/ui/Button';
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
        <div>
          <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">Nova data</label>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
          />
        </div>
        {error && <p className="text-xs font-body text-error">{error}</p>}
      </div>
    </Modal>
  );
}
