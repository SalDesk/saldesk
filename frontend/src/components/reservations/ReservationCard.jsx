import { useState } from 'react';
import StatusBadge from './StatusBadge';
import ConfirmDialog from '../ui/ConfirmDialog';
import { changeStatus, deleteReservation } from '../../services/reservationsService';
import useAuthStore from '../../store/authStore';
import { useToast } from '../../store/toastStore';

const PROXIMOS_STATUS = {
  pending:    [{ value: 'confirmed', label: 'Confirmar' }, { value: 'cancelled', label: 'Cancelar' }],
  confirmed:  [{ value: 'checked_in', label: 'Check-in' }, { value: 'cancelled', label: 'Cancelar' }],
  checked_in: [{ value: 'checked_out', label: 'Check-out' }],
  checked_out: [],
  cancelled:  []
};

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReservationCard({ reservation, onUpdate, onEdit }) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const proximos = PROXIMOS_STATUS[reservation.status] || [];

  async function handleStatus(status) {
    try {
      const { data } = await changeStatus(token, reservation.id, status);
      onUpdate(data);
      toast.success(`Estado alterado para "${status}"`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    try {
      await deleteReservation(token, reservation.id);
      onUpdate(null);
      toast.success('Reserva eliminada');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{reservation.customer_name}</p>
          <p className="text-xs text-gray-400">{reservation.customer_email}</p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p>🏠 {reservation.units?.name} <span className="text-gray-400">({reservation.units?.unit_type})</span></p>
        <p>📅 {fmt(reservation.check_in)} → {fmt(reservation.check_out)}</p>
        <p>👥 {reservation.guests} hóspede(s)</p>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="font-bold text-primary-500">{Number(reservation.total_price).toFixed(2)} €</span>
        <span className="text-xs text-gray-400">{reservation.source === 'public' ? 'Online' : 'Admin'}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {proximos.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleStatus(value)}
            className={value === 'cancelled' ? 'btn-danger text-xs py-1 px-3' : 'btn-primary text-xs py-1 px-3'}
          >
            {label}
          </button>
        ))}
        <button onClick={() => onEdit(reservation)} className="btn-secondary text-xs py-1 px-3 ml-auto">
          Editar
        </button>
        {['pending', 'cancelled'].includes(reservation.status) && (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 underline">
            Eliminar
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          mensagem={`Eliminar a reserva de ${reservation.customer_name}? Esta acção não pode ser desfeita.`}
          onConfirmar={handleDelete}
          onCancelar={() => setConfirmDelete(false)}
          labelConfirmar="Eliminar"
        />
      )}
    </div>
  );
}
