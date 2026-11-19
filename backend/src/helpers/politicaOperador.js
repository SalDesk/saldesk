/* Prazo de cancelamento gratis e confirmacao automatica por operador (regras puras).
   Spec: docs/superpowers/specs/2026-11-19-cancelamento-confirmacao-recolha-design.md */

/* null = sem prazo definido; 0 = sem cancelamento gratis; 168 = 7 dias */
const HORAS_CANCELAMENTO = [0, 24, 48, 72, 168];

function validarHorasCancelamento(valor) {
  if (valor === null || valor === '') return { ok: true, valor: null };
  if (typeof valor !== 'number' && typeof valor !== 'string') return { ok: false };
  if (typeof valor === 'string' && !/^[0-9]+$/.test(valor.trim())) return { ok: false };
  const n = Number(valor);
  return HORAS_CANCELAMENTO.includes(n) ? { ok: true, valor: n } : { ok: false };
}

/* A reserva publica e criada antes do pagamento online: so quem paga presencialmente fica
   confirmado logo (com a confirmacao automatica ligada). O pagamento online confirma ao capturar. */
function estadoInicialReserva({ autoConfirm, paymentMethod } = {}) {
  return autoConfirm === true && paymentMethod === 'cash' ? 'confirmed' : 'pending';
}

module.exports = { HORAS_CANCELAMENTO, validarHorasCancelamento, estadoInicialReserva };
