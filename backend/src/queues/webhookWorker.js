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

/* Encontra a unidade do operador correspondente ao produto OTA */
async function encontrarUnidade(operatorId, productCode) {
  const { data: units } = await supabaseAdmin
    .from('units')
    .select('id, name')
    .eq('operator_id', operatorId)
    .eq('status', 'active')
    .limit(1);
  return units?.[0] || null;
}

async function processWebhookJob({ data }) {
  const { channel, operatorId, payload, externalRef } = data;

  let normalizado;
  try {
    normalizado = channel === 'viator' ? normalizarViator(payload) : normalizarGyg(payload);
  } catch (err) {
    await actualizarLog(operatorId, channel, externalRef, 'failed', `Erro a normalizar payload: ${err.message}`);
    return;
  }

  /* Cancelamentos */
  if (normalizado.status === 'cancelled') {
    if (externalRef) {
      await supabaseAdmin
        .from('reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('operator_id', operatorId)
        .eq('source', channel)
        .like('notes_internal', `%${externalRef}%`);
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
    await actualizarLog(operatorId, channel, externalRef, 'failed', `Erro CRM: ${err.message}`);
    return;
  }

  /* Encontrar unidade */
  const unit = await encontrarUnidade(operatorId, normalizado.productCode);
  if (!unit) {
    await actualizarLog(operatorId, channel, externalRef, 'failed', 'Nenhuma unidade activa encontrada');
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
      notes_internal: externalRef ? `Ref. OTA: ${externalRef}` : null,
    });

    await actualizarLog(operatorId, channel, externalRef, 'processed', null);
  } catch (err) {
    await actualizarLog(operatorId, channel, externalRef, 'failed', `Erro ao criar reserva: ${err.message}`);
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

module.exports = { processWebhookJob };
