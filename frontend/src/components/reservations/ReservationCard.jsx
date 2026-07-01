import { useState } from 'react';
import { CalendarDays, User, ArrowRight, Pencil, Trash2, ChevronDown, Car } from 'lucide-react';
import { changeStatus, deleteReservation } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const STATUS_NEXT = {
  pending:    'confirmed',
  confirmed:  'checked_in',
  checked_in: 'checked_out',
};

const STATUS_LABEL_NEXT = {
  pending:    'Confirmar',
  confirmed:  'Check-in',
  checked_in: 'Check-out',
};

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function ReservationCard({ reservation: r, onUpdate, onEdit }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleNextStatus() {
    const next = STATUS_NEXT[r.status];
    if (!next) return;
    setLoading(true);
    try {
      const updated = await changeStatus(r.id, next);
      onUpdate(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteReservation(r.id);
      onUpdate(null, r.id);
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmDelete(false);
    }
  }

  const canAdvance = !!STATUS_NEXT[r.status];

  return (
    <>
      <div className="bg-white rounded-md border border-n-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
              <Badge variant={r.source === 'direct' || r.source === 'public' ? 'direct' : 'default'}>
                {t(`reservations.source.${r.source}`)}
              </Badge>
            </div>
            <p className="font-display font-semibold text-sm text-n-900 mt-2 truncate">
              {r.units?.name || '—'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display font-bold text-base text-ocean-700">
              €{Number(r.total_price).toFixed(2)}
            </p>
            <p className="text-xs font-body text-n-400">{r.guests} hósp.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-body text-n-600">
          <CalendarDays size={13} strokeWidth={1.75} className="text-n-400 shrink-0" />
          <span>{formatDate(r.check_in)}</span>
          <ArrowRight size={11} strokeWidth={1.75} className="text-n-300" />
          <span>{formatDate(r.check_out)}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-body text-n-600">
          <User size={13} strokeWidth={1.75} className="text-n-400 shrink-0" />
          <span className="truncate">{r.customer_name}</span>
          {r.customer_country && (
            <span className="shrink-0 text-n-400">· {r.customer_country}</span>
          )}
        </div>

        {r.fleet?.name && (
          <div className="flex items-center gap-2 text-xs font-body text-n-500">
            <Car size={13} strokeWidth={1.75} className="text-n-400 shrink-0" />
            <span>{r.fleet.name} ({r.fleet.capacity} lugares)</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-n-100">
          {canAdvance && (
            <Button
              size="sm"
              loading={loading}
              onClick={handleNextStatus}
              className="flex-1"
            >
              {STATUS_LABEL_NEXT[r.status]}
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r)} aria-label="Editar" />
          {r.status === 'pending' || r.status === 'cancelled' ? (
            <Button
              variant="ghost" size="sm" icon={Trash2}
              onClick={() => setConfirmDelete(true)}
              className="hover:text-error hover:bg-[var(--error-light)]"
              aria-label="Eliminar"
            />
          ) : null}
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
          {t('reservations.confirmDelete')}
        </p>
      </Modal>
    </>
  );
}
