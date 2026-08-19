import { useState, useEffect } from 'react';
import { Mail, Phone, Globe, Car, StickyNote, Clock } from 'lucide-react';
import { getReservation } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import LoadingSpinner from '../shared/LoadingSpinner';

const SOURCE_LABEL = {
  direct:       'Directo',
  public:       'Pag. Publica',
  booking_com:  'Booking.com',
  airbnb:       'Airbnb',
  viator:       'Viator',
  getyourguide: 'GetYourGuide',
  manual:       'Manual',
  conect:       'Conect',
  admin:        'Admin',
};

const PAYMENT_STATUS_LABEL = {
  pending:  'Pendente',
  paid:     'Pago',
  partial:  'Parcial',
  refunded: 'Reembolsado',
};

const PAYMENT_STATUS_VARIANT = {
  pending:  'pending',
  paid:     'confirmed',
  partial:  'pending',
  refunded: 'cancelled',
};

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={14} strokeWidth={1.75} className="text-n-400 shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-[10px] font-body font-semibold uppercase tracking-wide text-n-400">{label}</p>
        <p className="text-sm font-body text-n-900 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function ReservationDetailModal({ reservationId, open, onClose }) {
  const t = useT();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !reservationId) {
      setReservation(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    getReservation(reservationId)
      .then(setReservation)
      .catch((err) => setError(err.response?.data?.error || t('errors.generic')))
      .finally(() => setLoading(false));
  }, [open, reservationId]);

  const sameDay = reservation && reservation.check_in === reservation.check_out;

  return (
    <Modal open={open} onClose={onClose} title={t('reservations.details')} size="lg">
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size={28} />
        </div>
      ) : error ? (
        <p className="text-sm font-body text-error py-6 text-center">{error}</p>
      ) : reservation ? (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={reservation.status}>{t(`reservations.status.${reservation.status}`)}</Badge>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-xs uppercase tracking-wide bg-n-50 text-n-600 border border-n-200">
                  {SOURCE_LABEL[reservation.source] || reservation.source}
                </span>
                <span className="text-xs font-mono text-n-400">#{reservation.id?.slice(0, 8)}</span>
              </div>
              <p className="font-display font-bold text-lg text-n-900 mt-2">
                {reservation.units?.name || '—'}
              </p>
              {reservation.units?.unit_type && (
                <p className="text-xs font-body text-n-500">{reservation.units.unit_type}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-xl text-ocean-700">
                €{Number(reservation.total_price || 0).toFixed(2)}
              </p>
              {reservation.amount_paid != null && Number(reservation.amount_paid) > 0 && (
                <p className="text-xs font-body text-n-500">
                  {t('reservations.paid')}: €{Number(reservation.amount_paid).toFixed(2)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-n-100">
            <Row label={t('reservations.checkIn')} value={formatDate(reservation.check_in)} />
            {!sameDay && <Row label={t('reservations.checkOut')} value={formatDate(reservation.check_out)} />}
            <Row label={t('reservations.guests')} value={reservation.guests} />
            {reservation.payment_status && (
              <Row
                label={t('reservations.paymentStatus')}
                value={
                  <Badge variant={PAYMENT_STATUS_VARIANT[reservation.payment_status] || 'default'}>
                    {PAYMENT_STATUS_LABEL[reservation.payment_status] || reservation.payment_status}
                  </Badge>
                }
              />
            )}
            {reservation.payment_method && (
              <Row label={t('reservations.paymentMethod')} value={reservation.payment_method.toUpperCase()} />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-n-100">
            <Row label={t('reservations.customer')} value={reservation.customer_name} />
            <Row icon={Mail} label="Email" value={reservation.customer_email} />
            <Row icon={Phone} label="Telefone" value={reservation.customer_phone} />
            <Row icon={Globe} label="País" value={reservation.customer_country} />
          </div>

          {reservation.fleet?.name && (
            <div className="pt-4 border-t border-n-100">
              <Row icon={Car} label={t('reservations.vehicle')} value={`${reservation.fleet.name} (${reservation.fleet.capacity} lugares)`} />
            </div>
          )}

          {reservation.notes && (
            <div className="pt-4 border-t border-n-100">
              <Row icon={StickyNote} label={t('reservations.notes')} value={reservation.notes} />
            </div>
          )}

          <div className="pt-4 border-t border-n-100">
            <Row icon={Clock} label={t('reservations.createdAt')} value={formatDateTime(reservation.created_at)} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
