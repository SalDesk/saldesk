/* Esqueleto de melhor esforco para a API de "Reservation System" da
   GetYourGuide — os 6 endpoints obrigatorios listados no FAQ publico deles
   (Availability Query, Reservation, Reservation Cancellation, Booking,
   Booking Cancellation, Notify Availability).
   IMPORTANTE: a GYG so revela o esquema tecnico exacto (nomes de campos,
   formatos, codigos de erro) depois de sermos aceites no Integrator Portal.
   Os nomes de campos aqui sao convencoes razoaveis, a ajustar quando
   tivermos o spec real. */

const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');

const HOLD_MINUTES = 30;

async function encontrarUnidadePorProduto(productId) {
  const { data } = await supabaseAdmin
    .from('units')
    .select('*, pricing_rules(*), operators!inner(id, currency)')
    .eq('status', 'active')
    .contains('ota_product_ids', { getyourguide: productId })
    .maybeSingle();
  return data || null;
}

/* 1. Availability Query — GET /tours/:product_id/availability */
async function queryAvailability(req, res, next) {
  try {
    const { product_id } = req.params;
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from e date_to sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const unit = await encontrarUnidadePorProduto(product_id);
    if (!unit) {
      return res.status(404).json({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' });
    }

    const dias = [];
    const cur = new Date(date_from);
    const fim = new Date(date_to);
    while (cur <= fim) {
      const dataStr = cur.toISOString().split('T')[0];
      const proximoDia = new Date(cur);
      proximoDia.setDate(proximoDia.getDate() + 1);
      const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, dataStr, proximoDia.toISOString().split('T')[0]);
      dias.push({ date: dataStr, available: disponivel, capacity: unit.capacity });
      cur.setDate(cur.getDate() + 1);
    }

    return res.json({ data: { product_id, availability: dias } });
  } catch (err) {
    next(err);
  }
}

/* 2. Reservation (com tempo de retencao) — POST /tours/:product_id/reservations */
async function createReservation(req, res, next) {
  try {
    const { product_id } = req.params;
    const { date_from, date_to, participants, currency } = req.body;

    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from e date_to sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const unit = await encontrarUnidadePorProduto(product_id);
    if (!unit) {
      return res.status(404).json({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' });
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, date_from, date_to);
    if (!disponivel) {
      return res.status(409).json({ error: 'Sem disponibilidade para o periodo pedido', code: 'NOT_AVAILABLE' });
    }

    const { total } = calcularPreco(unit, date_from, date_to);
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

    const { data: hold, error } = await supabaseAdmin
      .from('ota_reservation_holds')
      .insert({
        operator_id:  unit.operators.id,
        unit_id:      unit.id,
        channel:      'getyourguide',
        check_in:     date_from,
        check_out:    date_to,
        participants: participants || 1,
        total_price:  total,
        currency:     currency || unit.operators?.currency || 'EUR',
        status:       'held',
        expires_at:   expiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      data: {
        reservation_id: hold.id,
        expires_at:      hold.expires_at,
        total_price:     hold.total_price,
        currency:        hold.currency,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* 3. Reservation Cancellation — DELETE /reservations/:reservation_id */
async function cancelReservation(req, res, next) {
  try {
    const { reservation_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('ota_reservation_holds')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reservation_id)
      .eq('status', 'held')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Reserva temporaria nao encontrada ou ja finalizada', code: 'NOT_FOUND' });
    }

    return res.json({ data: { reservation_id, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
}

/* 4. Booking — POST /reservations/:reservation_id/booking */
async function createBooking(req, res, next) {
  try {
    const { reservation_id } = req.params;
    const { traveller } = req.body;

    if (!traveller?.email) {
      return res.status(400).json({ error: 'traveller.email e obrigatorio', code: 'MISSING_FIELDS' });
    }

    const { data: hold } = await supabaseAdmin
      .from('ota_reservation_holds')
      .select('*')
      .eq('id', reservation_id)
      .eq('status', 'held')
      .maybeSingle();

    if (!hold) {
      return res.status(404).json({ error: 'Reserva temporaria nao encontrada ou expirada', code: 'NOT_FOUND' });
    }
    if (new Date(hold.expires_at) < new Date()) {
      await supabaseAdmin.from('ota_reservation_holds').update({ status: 'expired' }).eq('id', hold.id);
      return res.status(410).json({ error: 'Reserva temporaria expirada', code: 'HOLD_EXPIRED' });
    }

    const customer = await obterOuCriarCliente(hold.operator_id, {
      name:  traveller?.name  || 'GetYourGuide Guest',
      email: traveller?.email || null,
      phone: traveller?.phone || null,
      country_code: null,
    });

    const { data: reserva, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        operator_id:    hold.operator_id,
        unit_id:        hold.unit_id,
        customer_id:    customer.id,
        customer_name:  traveller?.name  || 'GetYourGuide Guest',
        customer_email: traveller.email,
        customer_phone: traveller?.phone || null,
        check_in:       hold.check_in,
        check_out:      hold.check_out,
        guests:         hold.participants,
        total_price:    hold.total_price,
        status:         'confirmed',
        source:         'getyourguide',
        notes:          `Ref. OTA hold: ${hold.id}`,
      })
      .select()
      .single();

    if (error) {
      /* reservations_no_overlap (database/040) -- a unidade ficou indisponivel
         entre o hold ser criado e este booking ser confirmado. */
      if (error.code === '23P01') {
        return res.status(409).json({ error: 'Unidade ja nao esta disponivel nessas datas', code: 'UNAVAILABLE' });
      }
      throw error;
    }

    await supabaseAdmin
      .from('ota_reservation_holds')
      .update({ status: 'booked', reservation_id: reserva.id, updated_at: new Date().toISOString() })
      .eq('id', hold.id);

    notifyAvailabilityChanged(hold.unit_id).catch(() => {});

    return res.status(201).json({ data: { booking_id: reserva.id, status: 'confirmed' } });
  } catch (err) {
    next(err);
  }
}

/* 5. Booking Cancellation — DELETE /bookings/:booking_id */
async function cancelBooking(req, res, next) {
  try {
    const { booking_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', booking_id)
      .eq('source', 'getyourguide')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Reserva nao encontrada', code: 'NOT_FOUND' });
    }

    notifyAvailabilityChanged(data.unit_id).catch(() => {});

    return res.json({ data: { booking_id, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
}

/* 6. Notify Availability — esta e a unica das 6 que, por convencao comum
   noutras integracoes OTA, e o SalDesk a empurrar PARA a GYG (nao a GYG a
   chamar-nos) sempre que a disponibilidade de uma unidade muda. Fica como
   helper interno chamado apos criar/cancelar bookings, nao como rota.
   Ajustar para o sentido correcto assim que confirmarmos no spec real. */
async function notifyAvailabilityChanged(unitId) {
  const url = process.env.GYG_NOTIFY_AVAILABILITY_URL;
  if (!url) return;
  const apiKey = process.env.GYG_INTEGRATOR_API_KEY;
  await axios.post(url, { unit_id: unitId }, { headers: { 'X-ACCESS-TOKEN': apiKey } });
}

module.exports = {
  queryAvailability,
  createReservation,
  cancelReservation,
  createBooking,
  cancelBooking,
  notifyAvailabilityChanged,
};
