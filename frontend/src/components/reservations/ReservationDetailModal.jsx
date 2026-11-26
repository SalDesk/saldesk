import { useState, useEffect } from 'react';
import { Mail, Phone, Globe, Car, StickyNote, Clock } from 'lucide-react';
import { getReservation } from '../../services/reservationsService';
import { useT } from '../../i18n';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import LoadingSpinner from '../shared/LoadingSpinner';
import WhatsAppSend from '../messaging/WhatsAppSend';
import { rotuloEstadoReserva } from '../../utils/estadoReserva';
import { mensagemErro } from '../../utils/mensagemErro';
import { localeDe, useLingua } from '../../utils/formatoLingua';
import { rotuloEstadoPagamento } from '../../pages/financial/shared';
import { formatDate, eurosDecimais, rotuloOrigem, rotuloMetodoReserva } from '../../pages/reservations/shared';

const PAYMENT_STATUS_VARIANT = {
  pending:  'pending',
  paid:     'confirmed',
  partial:  'pending',
  refunded: 'cancelled',
};

function formatDateTime(dt, lang) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(localeDe(lang), { dateStyle: 'short', timeStyle: 'short' });
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
  const lang = useLingua();
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
      .catch((err) => setError(mensagemErro(err, t, t('errors.generic'))))
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
                <Badge variant={reservation.status}>{rotuloEstadoReserva(reservation, t)}</Badge>
                <Badge>{rotuloOrigem(reservation.source, t)}</Badge>
                <span className="text-xs font-mono tabular-nums text-n-500">#{reservation.id?.slice(0, 8)}</span>
              </div>
              <p className="font-display font-bold text-lg text-n-900 mt-2">
                {reservation.units?.name || '—'}
              </p>
              {reservation.units?.unit_type && (
                <p className="text-xs font-body text-n-500">{reservation.units.unit_type}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-mono tabular-nums font-medium text-xl text-ocean-900">
                {eurosDecimais(reservation.total_price || 0, lang)}
              </p>
              {reservation.amount_paid != null && Number(reservation.amount_paid) > 0 && (
                <p className="text-xs font-body text-n-500">
                  {t('reservations.paid')}: {eurosDecimais(reservation.amount_paid, lang)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-n-100">
            <Row label={t('reservations.checkIn')} value={formatDate(reservation.check_in)} />
            {!sameDay && <Row label={t('reservations.checkOut')} value={formatDate(reservation.check_out)} />}
            {reservation.start_time && <Row label={t('reservations.time')} value={reservation.start_time.slice(0, 5)} />}
            <Row label={t('reservations.guests')} value={reservation.guests} />
            {reservation.payment_status && (
              <Row
                label={t('reservations.paymentStatus')}
                value={
                  <Badge variant={PAYMENT_STATUS_VARIANT[reservation.payment_status] || 'default'}>
                    {rotuloEstadoPagamento(reservation.payment_status, t)}
                  </Badge>
                }
              />
            )}
            {reservation.payment_method && (
              <Row label={t('reservations.paymentMethod')} value={rotuloMetodoReserva(reservation.payment_method, t, lang)} />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-n-100">
            <Row label={t('reservations.customer')} value={reservation.customer_name} />
            <Row icon={Mail} label={t('auth.email')} value={reservation.customer_email} />
            <Row icon={Phone} label={t('customers.phone')} value={reservation.customer_phone} />
            <Row icon={Globe} label={t('reservations.country')} value={reservation.customer_country} />
          </div>

          {(reservation.cancel_reason === 'payment_not_completed' || reservation.cancel_reason === 'paid_after_expiry') && (
            <div className="rounded-[14px] border border-sand-100 bg-sand-50 p-4 space-y-2">
              <p className="text-sm font-body text-n-700">
                {reservation.cancel_reason === 'paid_after_expiry' ? t('reservations.paidAfterExpiryHint') : t('reservations.abandonedHint')}
              </p>
              <div className="flex flex-wrap gap-4 text-sm font-body">
                {reservation.customer_email && (
                  <a href={`mailto:${reservation.customer_email}`} className="text-ocean-700 underline">{reservation.customer_email}</a>
                )}
                {reservation.customer_phone && (
                  <a
                    href={`https://wa.me/${String(reservation.customer_phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-700 underline"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          <WhatsAppSend
            reservationId={reservation.id}
            status={reservation.status}
            hasPhone={!!reservation.customer_phone}
          />

          {reservation.fleet?.name && (
            <div className="pt-4 border-t border-n-100">
              <Row icon={Car} label={t('reservations.vehicle')} value={t('reservations.vehicleSeats', { name: reservation.fleet.name, n: reservation.fleet.capacity })} />
            </div>
          )}

          {reservation.notes && (
            <div className="pt-4 border-t border-n-100">
              <Row icon={StickyNote} label={t('reservations.notes')} value={reservation.notes} />
            </div>
          )}

          <div className="pt-4 border-t border-n-100">
            <Row icon={Clock} label={t('reservations.createdAt')} value={formatDateTime(reservation.created_at, lang)} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
