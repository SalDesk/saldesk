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
   Paths e convencao de campos confirmados AO VIVO pelo self-testing tool
   do Integrator Portal (2026-08-18, via o logging de pedidos em
   routes/gygIntegrator.js): GET /1/get-availabilities?productId=...&
   fromDateTime=...&toDateTime=... -- sem path params, tudo em query string
   camelCase, datas ISO8601 completas (nao so a data). Os outros 4
   endpoints (reserve/cancel-reservation/book/cancel-booking) seguem a
   mesma convencao por inferencia (ainda nao exercitados individualmente
   pelo self-testing tool) -- ajustar assim que os proximos testes os
   confirmarem ou contradisserem. */

const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');

const HOLD_MINUTES = 60;

/* Categorias de bilhete que o SalDesk aceita hoje -- confirmado ao operador
   no formulario de configuracao do Integrator Portal (suporta CHILD alem
   de ADULT; nao suporta MILITARY nem as restantes ainda). Ajustar aqui se
   o suporte real mudar. */
const SUPPORTED_TICKET_CATEGORIES = ['ADULT', 'CHILD'];

function erro(res, errorCode, errorMessage, extra = {}) {
  return res.status(200).json({ errorCode, errorMessage, ...extra });
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

/* 1. Availability Query -- GET /1/get-availabilities?productId=...&
   fromDateTime=...&toDateTime=... (confirmado ao vivo). */
async function queryAvailability(req, res, next) {
  try {
    const { productId, fromDateTime, toDateTime } = req.query;

    if (!productId || !fromDateTime || !toDateTime) {
      return erro(res, 'VALIDATION_FAILURE', 'productId, fromDateTime and toDateTime are required.');
    }

    const unit = await encontrarUnidadePorProduto(productId);
    if (!unit) {
      return erro(res, 'INVALID_PRODUCT', 'This product does not exist or is not sellable.');
    }

    const availabilities = [];
    const cur = new Date(fromDateTime);
    const fim = new Date(toDateTime);
    if (isNaN(cur) || isNaN(fim)) {
      return erro(res, 'VALIDATION_FAILURE', 'fromDateTime and toDateTime must be valid ISO 8601 datetimes.');
    }
    while (cur <= fim) {
      const dataStr = cur.toISOString().split('T')[0];
      const proximoDia = new Date(cur);
      proximoDia.setDate(proximoDia.getDate() + 1);
      const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, dataStr, proximoDia.toISOString().split('T')[0]);
      availabilities.push({ dateTime: `${dataStr}T00:00:00-01:00`, vacancies: disponivel ? (unit.capacity || 1) : 0 });
      cur.setDate(cur.getDate() + 1);
    }

    return res.status(200).json({ data: { productId, availabilities } });
  } catch (err) {
    next(err);
  }
}

/* 2. Reservation ("reserve") -- retencao temporaria antes do booking final.
   Path e convencao de campos por inferencia do padrao confirmado em
   get-availabilities -- ainda nao exercitado individualmente. */
async function createReservation(req, res, next) {
  try {
    const corpo = { ...req.query, ...req.body };
    const { productId, fromDateTime, toDateTime, participants, currency, ticketCategory } = corpo;

    if (!productId || !fromDateTime || !toDateTime) {
      return erro(res, 'VALIDATION_FAILURE', 'productId, fromDateTime and toDateTime are required.');
    }
    if (ticketCategory && !SUPPORTED_TICKET_CATEGORIES.includes(ticketCategory)) {
      return erro(res, 'INVALID_TICKET_CATEGORY', `The ticket category ${ticketCategory} is not sellable.`, { ticketCategory });
    }

    const unit = await encontrarUnidadePorProduto(productId);
    if (!unit) {
      return erro(res, 'INVALID_PRODUCT', 'This product does not exist or is not sellable.');
    }

    const dateFrom = new Date(fromDateTime).toISOString().split('T')[0];
    const dateTo   = new Date(toDateTime).toISOString().split('T')[0];

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, dateFrom, dateTo);
    if (!disponivel) {
      return erro(res, 'NO_AVAILABILITY', 'This activity is sold out for the requested date.');
    }

    const { total } = calcularPreco(unit, dateFrom, dateTo);
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

    const { data: hold, error } = await supabaseAdmin
      .from('ota_reservation_holds')
      .insert({
        operator_id:  unit.operators.id,
        unit_id:      unit.id,
        channel:      'getyourguide',
        check_in:     dateFrom,
        check_out:    dateTo,
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

/* 3. Reservation Cancellation -- por inferencia, ainda nao confirmado. */
async function cancelReservation(req, res, next) {
  try {
    const { reservationReference } = { ...req.query, ...req.body };
    if (!reservationReference) {
      return erro(res, 'VALIDATION_FAILURE', 'reservationReference is required.');
    }

    const { data, error } = await supabaseAdmin
      .from('ota_reservation_holds')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reservationReference)
      .eq('status', 'held')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return erro(res, 'INVALID_RESERVATION', 'The specified reservation does not exist or is not in a valid state.');
    }

    return res.status(200).json({ data: { reservationReference, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
}

/* 4. Booking -- por inferencia, ainda nao confirmado. */
async function createBooking(req, res, next) {
  try {
    const { reservationReference, traveller, ticketCategory } = { ...req.query, ...req.body };

    if (!reservationReference) {
      return erro(res, 'VALIDATION_FAILURE', 'reservationReference is required.');
    }
    if (!traveller?.email) {
      return erro(res, 'VALIDATION_FAILURE', 'traveller.email is required.');
    }
    if (ticketCategory && !SUPPORTED_TICKET_CATEGORIES.includes(ticketCategory)) {
      return erro(res, 'INVALID_TICKET_CATEGORY', `The ticket category ${ticketCategory} is not sellable.`, { ticketCategory });
    }

    const { data: hold } = await supabaseAdmin
      .from('ota_reservation_holds')
      .select('*')
      .eq('id', reservationReference)
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

/* 5. Booking Cancellation -- por inferencia, ainda nao confirmado. */
async function cancelBooking(req, res, next) {
  try {
    const { bookingReference } = { ...req.query, ...req.body };
    if (!bookingReference) {
      return erro(res, 'VALIDATION_FAILURE', 'bookingReference is required.');
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingReference)
      .eq('source', 'getyourguide')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return erro(res, 'INVALID_BOOKING', 'The booking does not exist or is not in a valid state.');
    }

    notifyAvailabilityChanged(data.unit_id).catch(() => {});

    return res.status(200).json({ data: { bookingReference, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
}

/* 6. Notify Availability -- direccao SalDesk -> GYG (nos e que chamamos),
   nao uma rota. Credenciais desta direccao sao dadas pela GYG, distintas
   das que a GYG usa para nos chamar.
   Schema confirmado ao vivo contra o sandbox oficial (2026-08-18, via as
   mensagens de validacao devolvidas ao enviar payloads incompletos de
   proposito): { data: { productId, availabilities: [{ dateTime, vacancies }] } }.
   dateTime tem de estar dentro dos proximos 90 dias. Ilha do Sal nao tem
   horario de verao, por isso o offset -01:00 e sempre correcto. */
async function notifyAvailabilityChanged(unitId) {
  const url      = process.env.GYG_NOTIFY_AVAILABILITY_URL;
  const username = process.env.GYG_NOTIFY_USERNAME;
  const password = process.env.GYG_NOTIFY_PASSWORD;
  if (!url || !username || !password) return;

  const { data: unit } = await supabaseAdmin
    .from('units')
    .select('capacity, ota_product_ids')
    .eq('id', unitId)
    .maybeSingle();

  const productId = unit?.ota_product_ids?.getyourguide;
  if (!productId) return; // unidade nao ligada ao GYG

  const availabilities = [];
  const hoje = new Date();
  for (let i = 0; i < 90; i++) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() + i);
    const dataStr = dia.toISOString().split('T')[0];
    const proximoDia = new Date(dia);
    proximoDia.setDate(proximoDia.getDate() + 1);

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unitId, dataStr, proximoDia.toISOString().split('T')[0]);
    availabilities.push({
      dateTime:  `${dataStr}T00:00:00-01:00`,
      vacancies: disponivel ? (unit.capacity || 1) : 0,
    });
  }

  await axios.post(url, { data: { productId, availabilities } }, { auth: { username, password } });
}

module.exports = {
  queryAvailability,
  createReservation,
  cancelReservation,
  createBooking,
  cancelBooking,
  notifyAvailabilityChanged,
};
