/* Rotulo do estado de uma reserva para o operador. Alem do estado normal, distingue as
   reservas com cartao a meio do pagamento (lugar retido), as abandonadas e as pagas sem lugar. */
export function rotuloEstadoReserva(r, t, agora = new Date()) {
  if (r.cancel_reason === 'paid_after_expiry') return t('reservations.paidAfterExpiry');
  if (r.status === 'cancelled' && r.cancel_reason === 'payment_not_completed') return t('reservations.paymentNotCompleted');
  if (
    r.status === 'pending'
    && r.payment_status === 'pending'
    && (r.payment_method === 'paypal' || r.payment_method === 'sisp')
    && r.hold_expires_at
    && new Date(r.hold_expires_at) > agora
  ) return t('reservations.awaitingPayment');
  return t(`reservations.status.${r.status}`);
}
