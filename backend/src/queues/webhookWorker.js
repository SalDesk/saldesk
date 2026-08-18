const { supabaseAdmin } = require('../config/supabase');
const { obterOuCriarCliente } = require('../helpers/customerHelper');

/* Normaliza payload Viator → estrutura interna */
function normalizarViator(payload) {
  const b = payload.booking || payload;
  return {
    externalRef:   b.bookingRef || b.ref || null,
    eventType:     payload.event || 'booking_new',
    customerName:  b.leadTraveller?.name || b.customer?.name || 'Viator Guest',
    customerEmail: b.leadTraveller?.email || b.customer?.email || null,
    customerPhone: b.leadTraveller?.phone || null,
    checkIn:       b.travelDate || b.date || null,
    checkOut:      b.travelDate || b.date || null,
    guests:        b.numTravellers || b.pax || 1,
    totalPrice:    Number(b.totalAmount?.amount || b.price || 0),
    currency:      b.totalAmount?.currency || 'EUR',
    productCode:   b.productCode || null,
    status:        mapViatorStatus(payload.event),
  };
}

/* Normaliza payload GYG → estrutura interna */
function normalizarGyg(payload) {
  const b = payload.booking || payload;
  return {
    externalRef:   String(b.id || b.booking_id || ''),
    eventType:     payload.event || 'booking_new',
    customerName:  `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`.trim() || 'GYG Guest',
    customerEmail: b.customer?.email || null,
    customerPhone: b.customer?.phone || null,
    checkIn:       b.date_time || b.start_date || null,
    checkOut:      b.date_time || b.end_date || null,
    guests:        b.participants || b.pax || 1,
    totalPrice:    Number(b.price?.amount || b.total || 0),
    currency:      b.price?.currency || 'EUR',
    productCode:   String(b.tour_id || b.activity_id || ''),
    status:        mapGygStatus(b.status || payload.event),
  };
}

function mapViatorStatus(event) {
  const map = {
    BOOKING_CONFIRMED: 'confirmed',
    BOOKING_AMENDED:   'confirmed',
    BOOKING_CANCELLED: 'cancelled',
    booking_new:       'confirmed',
    booking_cancelled: 'cancelled',
  };
  return map[event] || 'pending';
}

function mapGygStatus(s) {
  const map = {
    confirmed: 'confirmed', pending: 'pending',
    cancelled: 'cancelled', booked: 'confirmed',
  };
  return map[s] || 'confirmed';
}

/* Encontra a unidade do operador correspondente ao produto OTA.
   Prioriza o mapeamento explicito units.ota_product_ids[channel] == productCode.
   So recorre a "unica unidade activa" quando nao ha ambiguidade possivel —
   caso contrario falha com uma razao clara em vez de adivinhar a unidade. */
async function encontrarUnidade(operatorId, channel, productCode) {
  const { data: units } = await supabaseAdmin
    .from('units')
    .select('id, name, ota_product_ids')
    .eq('operator_id', operatorId)
    .eq('status', 'active');

  const activas = units || [];
  if (activas.length === 0) {
    return { unit: null, reason: 'Nenhuma unidade activa encontrada' };
  }

  if (productCode) {
    const match = activas.find((u) => u.ota_product_ids?.[channel] === productCode);
    if (match) return { unit: match, reason: null };
  }

  if (activas.length === 1) {
    return { unit: activas[0], reason: null };
  }

  return {
    unit: null,
    reason: productCode
      ? `Produto OTA "${productCode}" nao esta mapeado a nenhuma unidade (operador tem ${activas.length} unidades activas). Configure o ID do produto na unidade correspondente.`
      : `Payload sem codigo de produto e o operador tem ${activas.length} unidades activas — impossivel determinar a unidade sem ambiguidade.`,
  };
}

async function processWebhookJob({ data }) {
  const { channel, operatorId, payload, externalRef } = data;

  let normalizado;
  try {
    normalizado = channel === 'viator' ? normalizarViator(payload) : normalizarGyg(payload);
  } catch (err) {
    await registarFalha(operatorId, channel, externalRef, `Erro a normalizar payload: ${err.message}`);
    return;
  }

  /* Cancelamentos */
  if (normalizado.status === 'cancelled') {
    if (externalRef) {
      const { data: cancelada } = await supabaseAdmin
        .from('reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('operator_id', operatorId)
        .eq('source', channel)
        .like('notes', `%${externalRef}%`)
        .select('id, customer_name')
        .maybeSingle();

      if (cancelada) {
        supabaseAdmin.from('notifications').insert({
          operator_id:       operatorId,
          notification_type: 'cancellation',
          content:            `Reserva de ${cancelada.customer_name} cancelada via ${channel}`,
          link:               `/reservas/${cancelada.id}`,
        }).then(({ error: notifErr }) => {
          if (notifErr) console.error('[Notificacao] Erro ao criar notificacao:', notifErr.message);
        });
      }
    }
    await actualizarLog(operatorId, channel, externalRef, 'processed', null);
    return;
  }

  /* Criar/obter cliente */
  let customer;
  try {
    if (!normalizado.customerEmail) throw new Error('Email em falta no payload');
    customer = await obterOuCriarCliente(operatorId, {
      name:         normalizado.customerName,
      email:        normalizado.customerEmail,
      phone:        normalizado.customerPhone,
      country_code: null,
    });
  } catch (err) {
    await registarFalha(operatorId, channel, externalRef, `Erro CRM: ${err.message}`, normalizado.customerName);
    return;
  }

  /* Encontrar unidade */
  const { unit, reason } = await encontrarUnidade(operatorId, channel, normalizado.productCode);
  if (!unit) {
    await registarFalha(operatorId, channel, externalRef, reason || 'Nenhuma unidade activa encontrada', normalizado.customerName);
    return;
  }

  /* Criar reserva */
  try {
    const checkIn  = normalizado.checkIn  ? normalizado.checkIn.split('T')[0]  : null;
    const checkOut = normalizado.checkOut ? normalizado.checkOut.split('T')[0] : checkIn;

    await supabaseAdmin.from('reservations').insert({
      operator_id:    operatorId,
      unit_id:        unit.id,
      customer_id:    customer.id,
      customer_name:  normalizado.customerName,
      customer_email: normalizado.customerEmail,
      customer_phone: normalizado.customerPhone,
      check_in:       checkIn,
      check_out:      checkOut || checkIn,
      guests:         normalizado.guests,
      total_price:    normalizado.totalPrice,
      status:         normalizado.status,
      source:         channel,
      notes: externalRef ? `Ref. OTA: ${externalRef}` : null,
    });

    await actualizarLog(operatorId, channel, externalRef, 'processed', null);
  } catch (err) {
    await registarFalha(operatorId, channel, externalRef, `Erro ao criar reserva: ${err.message}`, normalizado.customerName);
  }
}

async function actualizarLog(operatorId, channel, externalRef, status, errorMsg) {
  if (!externalRef) return;
  await supabaseAdmin
    .from('integration_logs')
    .update({ status, error_message: errorMsg || null })
    .eq('operator_id', operatorId)
    .eq('channel', channel)
    .eq('external_ref', externalRef)
    .eq('status', 'received');
}

/* Uma reserva OTA real que falha a importar nao pode desaparecer em
   silencio -- regista o log (ja existente) e cria tambem uma notificacao
   real para o operador, mesmo padrao ja usado no cancelamento acima. */
async function registarFalha(operatorId, channel, externalRef, motivo, customerName) {
  await actualizarLog(operatorId, channel, externalRef, 'failed', motivo);
  const quem = customerName ? ` de ${customerName}` : '';
  await supabaseAdmin.from('notifications').insert({
    operator_id:       operatorId,
    notification_type: 'ota_import_failed',
    content:            `Reserva${quem} via ${channel} falhou ao importar: ${motivo}`,
    link:               '/integracoes',
  }).then(({ error: notifErr }) => {
    if (notifErr) console.error('[Notificacao] Erro ao criar notificacao de falha OTA:', notifErr.message);
  });
}

module.exports = { processWebhookJob };
