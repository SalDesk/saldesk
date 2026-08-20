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

   get-availabilities: path confirmado ao vivo pelo self-testing tool do
   Integrator Portal (2026-08-18) -- GET /1/get-availabilities?productId=...&
   fromDateTime=...&toDateTime=.... O nome do campo da resposta e
   "availabilities" (plural), tal como o spec publico sempre descreveu --
   uma leitura anterior desta mesma sessao (2026-08-18) tinha concluido o
   contrario a partir de uma rejeicao do self-testing tool, mas o suporte da
   GYG confirmou por email (Ahmed, Equipe de Conectividade, 2026-08-20) que
   "availability" (singular) e invalido e a causa exacta da rejeicao. Corrigido
   de volta para "availabilities".

   reserve/cancel-reservation/book/cancel-booking: ainda NAO exercitados
   individualmente pelo self-testing tool. Reescritos em 2026-08-18 a partir
   do spec OpenAPI publico e oficial da GYG (nao um resumo nem um PDF --
   o proprio ficheiro fonte):
   https://integrator.getyourguide.com/assets/api_documentation/supplier-api-supplier-endpoints.yaml
   Diferencas importantes face ao esqueleto anterior (que era so inferencia):
   - Corpo do pedido vem SEMPRE dentro de {data: {...}} em JSON, nao em
     query string nem campos soltos.
   - reserve/book usam um "dateTime" UNICO (nao fromDateTime/toDateTime) --
     para produtos "Time Period" como os nossos, representa sempre as
     00:00:00 do dia reservado.
   - Participantes vao em "bookingItems": [{category, count, groupSize?}],
     nao um "participants" solto.
   - reserve e cancel-reservation exigem sempre "gygBookingReference".
   - book devolve "tickets": [{category, ticketCode, ticketCodeType}], nao
     so um status.
   - cancel-reservation e cancel-booking devolvem {data:{}} vazio no
     sucesso, nao um objecto com reservationReference/status.
   Ajustar assim que o self-testing tool os confirmar ou contradisser --
   mesma metodologia usada em get-availabilities. */

const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { verificarDisponibilidade, calcularPreco } = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');
const { criarNotificacaoViajante } = require('../helpers/travelerNotificationHelper');
const { frontendBase } = require('../utils/urls');

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

/* Calcula os dias indisponiveis de uma unidade num intervalo com so 2
   consultas (reservas + bloqueios), em vez de 2 consultas POR DIA como
   verificarDisponibilidade() faz quando chamada num ciclo -- para um
   intervalo de 30 dias isso eram ate 60 idas a BD, facilmente fora dos
   limites de tempo de resposta exigidos pela GYG (3-15s consoante o
   intervalo). Mesmo padrao ja usado em syncWorker.js, so que para uma
   unidade em vez de todas as unidades de um operador. */
async function diasIndisponiveisEmLote(unitId, dataInicio, dataFim) {
  const [reservasRes, bloqueiosRes] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select('check_in, check_out')
      .eq('unit_id', unitId)
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .lt('check_in', dataFim),
    supabaseAdmin
      .from('blocked_dates')
      .select('date')
      .eq('unit_id', unitId)
      .gte('date', dataInicio)
      .lt('date', dataFim),
  ]);

  const inicioJanela = new Date(dataInicio + 'T00:00:00Z');
  const indisponiveis = new Set();
  for (const r of reservasRes.data || []) {
    const cur = new Date(r.check_in + 'T00:00:00Z');
    const fimBruto = new Date(r.check_out + 'T00:00:00Z');
    /* Tours/actividades sao reservas de um so dia (check_in === check_out) --
       sem normalizar, "fim" ficava igual a "cur" e o while nunca corria,
       deixando esse dia por marcar como indisponivel para a GYG. O filtro
       gt('check_out', dataInicio) tambem excluia essas linhas da propria
       query; removido a favor deste corte em JS, ja com o "fim" correcto. */
    const fim = fimBruto > cur ? fimBruto : new Date(cur.getTime() + 86400000);
    if (fim <= inicioJanela) continue;
    while (cur < fim) {
      indisponiveis.add(cur.toISOString().split('T')[0]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  for (const b of bloqueiosRes.data || []) {
    indisponiveis.add(b.date);
  }
  return indisponiveis;
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

    const cur = new Date(fromDateTime);
    const fim = new Date(toDateTime);
    if (isNaN(cur) || isNaN(fim)) {
      return erro(res, 'VALIDATION_FAILURE', 'fromDateTime and toDateTime must be valid ISO 8601 datetimes.');
    }

    const dataInicio = cur.toISOString().split('T')[0];
    const proximoDiaFim = new Date(fim); proximoDiaFim.setDate(proximoDiaFim.getDate() + 1);
    const dataFimExclusiva = proximoDiaFim.toISOString().split('T')[0];
    const indisponiveis = await diasIndisponiveisEmLote(unit.id, dataInicio, dataFimExclusiva);

    /* productId vai DENTRO de cada item (nao uma vez so no topo), e produtos
       "Time Period" (o unico tipo que o SalDesk suporta hoje) tem de incluir
       openingTimes por item -- confirmado ao vivo pelo self-testing tool
       (2026-08-18). O SalDesk nao guarda horario de funcionamento por
       unidade, por isso usa-se sempre o dia inteiro (00:00-23:59), tal como
       a propria documentacao descreve para "opening times spanning the full
       day". O nome do campo e "availabilities" (plural) -- ver comentario
       do topo do ficheiro. openingTimes e um ARRAY de intervalos (nao um
       objecto unico) -- confirmado pelo erro exacto de desserializacao
       Jackson do self-testing tool (2026-08-20): DTO real e
       ArrayList<SupplierApiAvailabilityOpeningTimesDTO>. */
    const availabilities = [];
    const diaCorrente = new Date(cur);
    while (diaCorrente <= fim) {
      const dataStr = diaCorrente.toISOString().split('T')[0];
      availabilities.push({
        productId,
        dateTime:     `${dataStr}T00:00:00-01:00`,
        vacancies:    indisponiveis.has(dataStr) ? 0 : (unit.capacity || 1),
        openingTimes: [{ fromTime: '00:00', toTime: '23:59' }],
      });
      diaCorrente.setDate(diaCorrente.getDate() + 1);
    }

    return res.status(200).json({ data: { availabilities } });
  } catch (err) {
    next(err);
  }
}

/* Soma os "count" de bookingItems e valida que todas as categorias sao
   vendiveis -- usado por reserve e por book (o spec garante que os
   bookingItems de book replicam os de reserve, por isso a mesma validacao
   serve para os dois). Devolve null se alguma categoria for invalida. */
function validarBookingItems(bookingItems) {
  if (!Array.isArray(bookingItems) || bookingItems.length === 0) return null;
  let total = 0;
  for (const item of bookingItems) {
    if (!SUPPORTED_TICKET_CATEGORIES.includes(item.category)) return null;
    total += Number(item.count) || 0;
  }
  if (total <= 0) return null;
  return total;
}

/* 2. Reservation ("reserve") -- retencao temporaria antes do booking final.
   Corpo confirmado pelo spec OpenAPI publico da GYG (ver comentario no
   topo do ficheiro): POST /1/reserve/, {data:{productId, dateTime,
   bookingItems, gygBookingReference}}. */
async function createReservation(req, res, next) {
  try {
    const corpo = req.body?.data || {};
    const { productId, dateTime, bookingItems, gygBookingReference } = corpo;

    if (!productId || !dateTime || !gygBookingReference) {
      return erro(res, 'VALIDATION_FAILURE', 'productId, dateTime and gygBookingReference are required.');
    }

    const totalParticipantes = validarBookingItems(bookingItems);
    if (totalParticipantes === null) {
      return erro(res, 'INVALID_TICKET_CATEGORY', 'One or more requested ticket categories are not sellable.');
    }

    const unit = await encontrarUnidadePorProduto(productId);
    if (!unit) {
      return erro(res, 'INVALID_PRODUCT', 'This product does not exist or is not sellable.');
    }

    /* Produto "Time Period" -- a data pedida representa sempre um dia
       inteiro (00:00-23:59, ver queryAvailability), por isso check_in e
       check_out sao o mesmo dia e o dia seguinte, respectivamente. */
    const dataPedida = new Date(dateTime);
    if (isNaN(dataPedida)) {
      return erro(res, 'VALIDATION_FAILURE', 'dateTime must be a valid ISO 8601 datetime.');
    }
    const dateFrom = dataPedida.toISOString().split('T')[0];
    const diaSeguinte = new Date(dataPedida); diaSeguinte.setDate(diaSeguinte.getDate() + 1);
    const dateTo = diaSeguinte.toISOString().split('T')[0];

    const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, dateFrom, dateTo);
    if (!disponivel) {
      return erro(res, 'NO_AVAILABILITY', 'This activity is sold out for the requested date.');
    }

    /* calcularPreco devolve o preco de UM dia para a unidade (nao multiplica
       por pessoas) -- mesma convencao ja usada em publicController.criarReserva
       e reservationsController.criar (nao ha ainda preco diferenciado por
       categoria de bilhete em lado nenhum do motor de precos, so um
       base_price por unidade, por isso ADULT e CHILD contam da mesma forma
       aqui, tal como no resto da app). */
    const { total: precoDia } = calcularPreco(unit, dateFrom, dateTo);
    const total = Math.round(precoDia * totalParticipantes * 100) / 100;
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

    const { data: hold, error } = await supabaseAdmin
      .from('ota_reservation_holds')
      .insert({
        operator_id:  unit.operators.id,
        unit_id:      unit.id,
        channel:      'getyourguide',
        external_ref: gygBookingReference,
        check_in:     dateFrom,
        check_out:    dateTo,
        participants: totalParticipantes,
        total_price:  total,
        currency:     unit.operators?.currency || 'EUR',
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
      },
    });
  } catch (err) {
    next(err);
  }
}

/* 3. Reservation Cancellation -- confirmado pelo spec: POST
   /1/cancel-reservation/, {data:{gygBookingReference, reservationReference}},
   sucesso devolve {data:{}} vazio. */
async function cancelReservation(req, res, next) {
  try {
    const { reservationReference, gygBookingReference } = req.body?.data || {};
    if (!reservationReference || !gygBookingReference) {
      return erro(res, 'VALIDATION_FAILURE', 'reservationReference and gygBookingReference are required.');
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

    return res.status(200).json({ data: {} });
  } catch (err) {
    next(err);
  }
}

/* 4. Booking -- confirmado pelo spec: POST /1/book/, {data:{productId,
   reservationReference, gygBookingReference, currency, dateTime,
   bookingItems, travelers, comment}}, sucesso devolve {data:{bookingReference,
   tickets:[{category, ticketCode, ticketCodeType}]}}. */
async function createBooking(req, res, next) {
  try {
    const corpo = req.body?.data || {};
    const { reservationReference, gygBookingReference, bookingItems, travelers, comment } = corpo;

    if (!reservationReference || !gygBookingReference || !comment) {
      return erro(res, 'VALIDATION_FAILURE', 'reservationReference, gygBookingReference and comment are required.');
    }
    if (!Array.isArray(travelers) || travelers.length === 0 || !travelers[0]?.email) {
      return erro(res, 'VALIDATION_FAILURE', 'travelers[] with at least one entry (email, firstName, lastName, phoneNumber) is required.');
    }
    if (validarBookingItems(bookingItems) === null) {
      return erro(res, 'INVALID_TICKET_CATEGORY', 'One or more requested ticket categories are not sellable.');
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

    const traveller = travelers[0];
    const nomeCompleto = [traveller.firstName, traveller.lastName].filter(Boolean).join(' ') || 'GetYourGuide Guest';

    const customer = await obterOuCriarCliente(hold.operator_id, {
      name:  nomeCompleto,
      email: traveller.email || null,
      phone: traveller.phoneNumber || null,
      country_code: null,
    });

    const { data: reserva, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        operator_id:    hold.operator_id,
        unit_id:        hold.unit_id,
        customer_id:    customer.id,
        customer_name:  nomeCompleto,
        customer_email: traveller.email,
        customer_phone: traveller.phoneNumber || null,
        check_in:       hold.check_in,
        check_out:      hold.check_out,
        guests:         hold.participants,
        total_price:    hold.total_price,
        status:         'confirmed',
        source:         'getyourguide',
        notes:          `GYG booking ref: ${gygBookingReference}. Comment: ${comment}`,
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
    /* So dispara se o email da reserva GYG coincidir com uma conta de
       viajante SalDesk ja existente -- normalmente nao coincide, ja que
       clientes da GYG reservam inteiramente dentro da plataforma deles. */
    criarNotificacaoViajante(
      traveller.email, 'booking_confirmed', 'A sua reserva foi confirmada.', `${frontendBase()}/viajante`,
    ).catch(() => {});

    /* Nao ha sistema de bilhetes/QR real -- gera-se um codigo TEXT interno
       por participante, um por cada bookingItem.count, tal como o schema
       Ticket exige (category+ticketCode+ticketCodeType por participante). */
    const tickets = [];
    let n = 0;
    for (const item of bookingItems) {
      for (let i = 0; i < item.count; i++) {
        n += 1;
        tickets.push({
          category: item.category,
          ticketCode: `SALDESK-${reserva.id}-${n}`,
          ticketCodeType: 'TEXT',
        });
      }
    }

    return res.status(200).json({ data: { bookingReference: reserva.id, tickets } });
  } catch (err) {
    next(err);
  }
}

/* 5. Booking Cancellation -- confirmado pelo spec: POST /1/cancel-booking/,
   {data:{bookingReference, gygBookingReference, productId}}, sucesso
   devolve {data:{}} vazio. */
async function cancelBooking(req, res, next) {
  try {
    const { bookingReference, gygBookingReference, productId } = req.body?.data || {};
    if (!bookingReference || !gygBookingReference || !productId) {
      return erro(res, 'VALIDATION_FAILURE', 'bookingReference, gygBookingReference and productId are required.');
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
    criarNotificacaoViajante(
      data.customer_email, 'cancelled', 'A sua reserva foi cancelada.', `${frontendBase()}/viajante`,
    ).catch(() => {});

    return res.status(200).json({ data: {} });
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

  const hoje = new Date();
  const dataInicio = hoje.toISOString().split('T')[0];
  const dataFimExclusiva = new Date(hoje); dataFimExclusiva.setDate(dataFimExclusiva.getDate() + 90);
  const indisponiveis = await diasIndisponiveisEmLote(unitId, dataInicio, dataFimExclusiva.toISOString().split('T')[0]);

  const availabilities = [];
  for (let i = 0; i < 90; i++) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() + i);
    const dataStr = dia.toISOString().split('T')[0];
    availabilities.push({
      dateTime:  `${dataStr}T00:00:00-01:00`,
      vacancies: indisponiveis.has(dataStr) ? 0 : (unit.capacity || 1),
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
