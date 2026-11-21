/* Avisos de uma reserva publica: notificacao ao operador, email ao cliente e email ao operador.
   Reservas pagas com cartao adiam estes avisos ate o pagamento ser confirmado. */
const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail } = require('./emailHelper');
const { detectarIdioma } = require('./languageHelper');
const { confirmacaoClienteEmail, notificacaoOperadorEmail } = require('./emailTemplates');
const { registarUsoVoucher } = require('../controllers/vouchersController');

const AVISO_INCOMPLETO = 'Pagamento incompleto — verificar';

// Nunca lanca: qualquer falha fica so no log.
async function avisarNovaReserva({ reserva, operator, unitName, totalOperador, incompleto = false }) {
  try {
    const jaConfirmada = reserva.status === 'confirmed';
    const currency = operator.currency || 'EUR';

    const base = reserva.driver_included
      ? `Nova reserva EXECUTIVO com motorista de ${reserva.customer_name} — ${unitName} (atribuir condutor)`
      : `Nova reserva de ${reserva.customer_name} — ${unitName}`;
    const content = base + (jaConfirmada ? ' (já confirmada)' : '') + (incompleto ? ` — ${AVISO_INCOMPLETO}` : '');

    supabaseAdmin.from('notifications').insert({
      operator_id:       operator.id,
      notification_type: 'new_booking',
      content,
      link:              `/reservas/${reserva.id}`,
    }).then(({ error: notifErr }) => {
      if (notifErr) console.error('[Notificacao] Erro ao criar notificacao:', notifErr.message);
    });

    const idioma = detectarIdioma(reserva.customer_country);

    if (!incompleto) {
      /* O email de confirmacao mostra o nome real da mesa/unidade. */
      const clienteEmail = confirmacaoClienteEmail({
        idioma,
        customerName: reserva.customer_name,
        tourName: unitName,
        checkIn: reserva.check_in,
        checkOut: reserva.check_out,
        guests: reserva.guests,
        total: reserva.total_price,
        currency,
        operator,
        status: reserva.status,
      });
      enviarEmail({
        to: reserva.customer_email,
        subject: clienteEmail.subject,
        html: clienteEmail.html,
        text: clienteEmail.text,
      }).catch((err) => console.error('[Email] Erro ao enviar recepção:', err.message));
    }

    if (operator.email) {
      const operadorEmail = notificacaoOperadorEmail({
        operatorName: operator.name,
        tourName: unitName,
        checkIn: reserva.check_in,
        checkOut: reserva.check_out,
        guests: reserva.guests,
        total: totalOperador ?? reserva.total_price,
        currency,
        customer: {
          name: reserva.customer_name,
          email: reserva.customer_email,
          phone: reserva.customer_phone,
          country: reserva.customer_country,
        },
        notes: incompleto
          ? (reserva.notes ? `${AVISO_INCOMPLETO} | ${reserva.notes}` : AVISO_INCOMPLETO)
          : reserva.notes,
        confirmada: jaConfirmada,
      });
      enviarEmail({
        to: operator.email,
        subject: operadorEmail.subject,
        html: operadorEmail.html,
        text: operadorEmail.text,
      }).catch((err) => console.error('[Email] Erro ao enviar notificação ao operador:', err.message));
    }
  } catch (err) {
    console.error('[Avisos] Erro ao avisar nova reserva:', err.message);
  }
}

// Reserva ja paga (ou paga a menos): gasta o voucher e envia os avisos adiados.
async function concluirReservaPaga(reserva, { incompleto = false } = {}) {
  if (!incompleto && reserva.voucher_id) {
    try {
      await registarUsoVoucher(reserva.voucher_id);
    } catch (err) {
      console.error('[Voucher] Erro ao registar uso:', err.message);
    }
  }
  await avisarNovaReserva({
    reserva,
    operator: reserva.operators,
    unitName: reserva.units?.name,
    incompleto,
  });
}

module.exports = { avisarNovaReserva, concluirReservaPaga };
