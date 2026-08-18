/* API "Reservation System" da GetYourGuide -- os 6 endpoints obrigatorios
   listados no FAQ publico deles (Availability Query, Reservation,
   Reservation Cancellation, Booking, Booking Cancellation, Notify
   Availability). Regras de contrato confirmadas na documentacao oficial
   (Integrator Portal, pagina "Overview", lida em 2026-08-18):
   - Autenticacao: HTTP Basic Auth (ver verifyGygIntegrator.js).
   - TODA a resposta e HTTP 200 -- qualquer outro status e tratado pela GYG
     como falha de transporte/servidor. O corpo tem OU {data: ...} (sucesso)
     OU {errorCode, errorMessage} (falha), nunca os dois.
   - Catalogo real de errorCode confirmado: AUTHORIZATION_FAILURE,
     INVALID_PRODUCT, VALIDATION_FAILURE, INTERNAL_SYSTEM_FAILURE,
     NO_AVAILABILITY, INVALID_TICKET_CATEGORY,
     INVALID_PARTICIPANTS_CONFIGURATION, INVALID_RESERVATION,
     INVALID_BOOKING, INVALID_SUPPLIER.
   - Tempo de retencao: desejado 60min, minimo 15min.
   AINDA POR CONFIRMAR (falta a pagina "Supplier-side Endpoints" da
   documentacao, com os nomes de campo exactos por endpoint): paths reais,
   nomes de campos no corpo do pedido/resposta, estrutura de categorias de
   bilhete (ADULT/CHILD/.../GROUP/COLLECTIVE) e groupConfiguration para
   bilhetes de grupo, distincao time-point vs time-period. Ate isso chegar,
   os nomes de campos abaixo continuam a ser convencoes razoaveis, nao o
   spec confirmado -- so os codigos de erro e o formato de resposta (200
   sempre) sao definitivos. */

const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');

const HOLD_MINUTES = 60;

function erro(res, errorCode, errorMessage) {
  return res.status(200).json({ errorCode, errorMessage });
}

async function encontrarUnidadePorProduto(productId) {
  const { data } = await supabaseAdmin
    .from('units')
    .select('*, pricing_rules(*), operators!inner(id, currency)')
    .eq('status', 'active')
    .contains('ota_product_ids', { getyourguide: productId })
    .maybeSingle();
  return data || null;
}

/* 1. Availability Query */
async function queryAvailability(req, res, next) {
  try {
    const { product_id } = req.params;
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return erro(res, 'VALIDATION_FAILURE', 'date_from and date_to are required.');
    }

    const unit = await encontrarUnidadePorProduto(product_id);
    if (!unit) {
      return erro(res, 'INVALID_PRODUCT', 'This product does not exist or is not sellable.');
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

    return res.status(200).json({ data: { product_id, availability: dias } });
  } catch (err) {
    next(err);
  }
}

/* 2. Reservation ("reserve") -- retencao temporaria antes do booking final */
async function createReservation(req, res, next) {
  try {
    const { product_id } = req.params;
    const { date_from, date_to, participants, currency } = req.body;

    if (!date_from || !date_to) {
      return erro(res, 'VALIDATION_FAILURE', 'date_from and date_to are required.');
    }

    const unit = await encontrarUnidadePorProduto(product_id);
    if (!unit) {
      return erro(res, 'INVALID_PRODUCT', 'This product does not exist or is not sellable.');
    }

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, date_from, date_to);
    if (!disponivel) {
      return erro(res, 'NO_AVAILABILITY', 'This activity is sold out for the requested date.');
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

    return res.status(200).json({
      data: {
        reservationReference:  hold.id,
        reservationExpiration: hold.expires_at,
        totalPrice:            hold.total_price,
        currency:              hold.currency,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* 3. Reservation Cancellation */
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
      return erro(res, 'INVALID_RESERVATION', 'The specified reservation does not exist or is not in a valid state.');
    }

    return res.status(200).json({ data: { reservationReference: reservation_id, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
}

/* 4. Booking */
async function createBooking(req, res, next) {
  try {
    const { reservation_id } = req.params;
    const { traveller } = req.body;

    if (!traveller?.email) {
      return erro(res, 'VALIDATION_FAILURE', 'traveller.email is required.');
    }

    const { data: hold } = await supabaseAdmin
      .from('ota_reservation_holds')
      .select('*')
      .eq('id', reservation_id)
      .eq('status', 'held')
      .maybeSingle();

    if (!hold) {
      return erro(res, 'INVALID_RESERVATION', 'The specified reservation does not exist or is not in a valid state.');
    }
    if (new Date(hold.expires_at) < new Date()) {
      await supabaseAdmin.from('ota_reservation_holds').update({ status: 'expired' }).eq('id', hold.id);
      return erro(res, 'INVALID_RESERVATION', `Expired reservation; ${HOLD_MINUTES}min hold time was exceeded.`);
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
        return erro(res, 'NO_AVAILABILITY', 'This activity is no longer available for the requested date.');
      }
      throw error;
    }

    await supabaseAdmin
      .from('ota_reservation_holds')
      .update({ status: 'booked', reservation_id: reserva.id, updated_at: new Date().toISOString() })
      .eq('id', hold.id);

    notifyAvailabilityChanged(hold.unit_id).catch(() => {});

    return res.status(200).json({ data: { bookingReference: reserva.id, status: 'confirmed' } });
  } catch (err) {
    next(err);
  }
}

/* 5. Booking Cancellation */
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
      return erro(res, 'INVALID_BOOKING', 'The booking does not exist or is not in a valid state.');
    }

    notifyAvailabilityChanged(data.unit_id).catch(() => {});

    return res.status(200).json({ data: { bookingReference: booking_id, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
}

/* 6. Notify Availability -- direccao SalDesk -> GYG (nos e que chamamos),
   nao uma rota. Credenciais desta direccao sao dadas pela GYG, distintas
   das que a GYG usa para nos chamar. */
async function notifyAvailabilityChanged(unitId) {
  const url = process.env.GYG_NOTIFY_AVAILABILITY_URL;
  if (!url) return;
  const username = process.env.GYG_NOTIFY_USERNAME;
  const password = process.env.GYG_NOTIFY_PASSWORD;
  if (!username || !password) return;
  await axios.post(url, { unit_id: unitId }, { auth: { username, password } });
}

module.exports = {
  queryAvailability,
  createReservation,
  cancelReservation,
  createBooking,
  cancelBooking,
  notifyAvailabilityChanged,
};
