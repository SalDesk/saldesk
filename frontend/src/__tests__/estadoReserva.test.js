import { describe, expect, it } from 'vitest';
import { rotuloEstadoReserva } from '../utils/estadoReserva';

/* t simulado: devolve a propria chave, para ver qual o ramo escolhido */
const t = (k) => k;
const AGORA = new Date('2026-11-21T12:00:00Z');
const FUTURO = '2026-11-21T12:20:00Z';
const PASSADO = '2026-11-21T11:50:00Z';

function reserva(over) {
  return { status: 'pending', payment_status: 'pending', payment_method: 'paypal', hold_expires_at: FUTURO, cancel_reason: null, ...over };
}

describe('rotuloEstadoReserva', () => {
  it('pago_sem_lugar_tem_prioridade', () => {
    expect(rotuloEstadoReserva(reserva({ status: 'cancelled', payment_status: 'paid', cancel_reason: 'paid_after_expiry' }), t, AGORA))
      .toBe('reservations.paidAfterExpiry');
  });
  it('cancelada_por_pagamento_nao_concluido', () => {
    expect(rotuloEstadoReserva(reserva({ status: 'cancelled', cancel_reason: 'payment_not_completed' }), t, AGORA))
      .toBe('reservations.paymentNotCompleted');
  });
  it('pendente_com_retencao_activa_aguarda_pagamento', () => {
    expect(rotuloEstadoReserva(reserva(), t, AGORA)).toBe('reservations.awaitingPayment');
    expect(rotuloEstadoReserva(reserva({ payment_method: 'sisp' }), t, AGORA)).toBe('reservations.awaitingPayment');
  });
  it('hold_vencido_mas_ainda_pending_mostra_pendente', () => {
    expect(rotuloEstadoReserva(reserva({ hold_expires_at: PASSADO }), t, AGORA)).toBe('reservations.status.pending');
  });
  it('sem_hold_ou_metodo_em_dinheiro_mostra_o_estado', () => {
    expect(rotuloEstadoReserva(reserva({ hold_expires_at: null }), t, AGORA)).toBe('reservations.status.pending');
    expect(rotuloEstadoReserva(reserva({ payment_method: 'cash' }), t, AGORA)).toBe('reservations.status.pending');
  });
  it('outros_estados_usam_a_traducao_normal', () => {
    expect(rotuloEstadoReserva({ status: 'confirmed' }, t, AGORA)).toBe('reservations.status.confirmed');
    expect(rotuloEstadoReserva({ status: 'cancelled', cancel_reason: 'replaced' }, t, AGORA)).toBe('reservations.status.cancelled');
  });
});
