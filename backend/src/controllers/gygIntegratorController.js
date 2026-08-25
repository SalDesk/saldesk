/* API "Supplier API" (fornecedor unico) da GetYourGuide -- os 6 endpoints obrigatorios
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

   Integrator Portal, "Set up your testing configuration" -- decisao final
   confirmada por dois emails do Ahmed (Equipe de Conectividade GYG):
   - 2026-08-25 (1o email): sugeriu System Type = "custom system build for
     a single supplier" em vez de "Reservation System".
   - Questionamos: o SalDesk serve VARIOS operadores reais (Zy Tours,
     Global Africa, etc.), todos atras de uma UNICA ligacao/credencial do
     Integrator Portal (ver verifyGygIntegrator.js) -- nao pareceria mais
     correcto "Reservation System" (multiplos operadores)?
   - 2026-08-25 (2o email, resposta): "Reservation System" OBRIGA a passar
     o self-testing tool do Sandbox para os 4 tipos de disponibilidade
     (Time point/Time period x Individuals/Groups); se nao suportar todos,
     tem de mudar para "Supplier API". Ou seja, a classificacao da GYG e
     sobre CAPACIDADE TECNICA da integracao, nao sobre a estrutura do
     negocio por tras -- um sistema pode servir varios operadores reais e
     ainda assim ser "Supplier API" se so implementar um subconjunto dos
     4 tipos.
   - Como o codigo so implementa "Time period for Individuals" (sem slots
     de hora, sem groupSize/preco fixo por grupo -- ver comentarios
     abaixo), o SalDesk falharia os testes de Sandbox dos outros 3 tipos
     se ficasse em "Reservation System". Decisao final (nessa altura):
     System Type = "Supplier API" (custom system build for a single
     supplier), e das 4 configuracoes de produto so "Time period for
     Individuals" ficou marcada.

   2026-08-25 (mais tarde, mesmo dia): "Time point for Individuals" foi
   implementado a serio (ver TourForm's TimeSlotsEditor, units.description
   ganha time_slots:[{time,capacity}], reservations.start_time passa a ser
   preenchido para actividades com slot escolhido). queryAvailability/
   createReservation/createBooking/notifyAvailabilityChanged ramificam
   agora consoante a unidade ligada ao productId TEM ou NAO time_slots
   configurado -- sem nenhum slot, o caminho "Time period" mantem-se
   byte-a-byte igual ao que ja estava confirmado pelo self-testing tool;
   com slots, entra o caminho novo "Time point" (uma entrada de
   disponibilidade por slot, dateTime com a hora real, sem openingTimes --
   confirmado no spec publico OpenAPI, nao no self-testing tool).
   IMPORTANTE -- isto AINDA NAO foi exercitado pelo self-testing tool do
   Sandbox (ao contrario do resto deste ficheiro, que so foi corrigido
   depois de testado ao vivo): antes de qualquer unidade real usar slots
   em produtos ligados ao GYG, correr o self-testing tool contra este
   caminho novo e, so depois de confirmado (ou corrigido, mesma
   metodologia ja usada no resto do ficheiro), voltar ao Integrator Portal
   e marcar tambem "Time point for Individuals" (a par de "Time period for
   Individuals", que continua correcta para unidades sem slots -- os dois
   coexistem, cada unidade usa o que tiver configurado).

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
const {
  verificarDisponibilidade, calcularPreco, parseUnitMeta,
  verificarDisponibilidadeSlot, normalizarHora, ocupacaoSlotsEmLote,
} = require('../helpers/bookingHelpers');
const { obterOuCriarCliente } = require('../helpers/customerHelper');
const { criarNotificacaoViajante } = require('../helpers/travelerNotificationHelper');
const { frontendBase } = require('../utils/urls');

const HOLD_MINUTES = 60;

/* Extrai data+hora LOCAL directamente da string "YYYY-MM-DDTHH:MM..." sem
   passar por new Date()/.toISOString() -- essa conversao normaliza para
   UTC, e como o offset que sempre usamos e -01:00 (Ilha do Sal, sem
   horario de verao), um slot perto da meia-noite (ex. 23:30) podia
   atravessar para o dia seguinte em UTC e devolver a data errada. Como o
   dateTime que recebemos em reserve/book e sempre o MESMO valor que nos
   proprios geramos em queryAvailability, parse-lo como string simples e
   sempre fiavel, nunca precisa de conversao de fuso. */
function extrairDataHoraLocal(dateTimeStr) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(dateTimeStr || ''));
  return m ? { date: m[1], time: m[2] } : { date: null, time: null };
}

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

    /* Unidade com horarios configurados (TourForm's TimeSlotsEditor) --
       produto "Time point": uma entrada por (dia x slot), dateTime com a
       HORA especifica do slot (nao meia-noite), sem openingTimes (essa
       chave e exclusiva de "Time Period" -- confirmado no spec publico da
       GYG, ver comentario no topo do ficheiro). Sem nenhum horario
       configurado, mantem-se o caminho antigo "Time Period" inalterado. */
    const unitMetaAvail = parseUnitMeta(unit);
    const activitySlots = Array.isArray(unitMetaAvail.time_slots) ? unitMetaAvail.time_slots : [];
    const availabilities = [];
    const diaCorrente = new Date(cur);

    if (activitySlots.length > 0) {
      const ocupacao = await ocupacaoSlotsEmLote(supabaseAdmin, unit.id, dataInicio, dataFimExclusiva);
      while (diaCorrente <= fim) {
        const dataStr = diaCorrente.toISOString().split('T')[0];
        const ocupadosPorHora = ocupacao[dataStr] || {};
        for (const slot of activitySlots) {
          const ocupados = ocupadosPorHora[normalizarHora(slot.time)] || 0;
          availabilities.push({
            productId,
            dateTime:  `${dataStr}T${slot.time}:00-01:00`,
            vacancies: Math.max(0, (Number(slot.capacity) || 0) - ocupados),
          });
        }
        diaCorrente.setDate(diaCorrente.getDate() + 1);
      }
    } else {
      const indisponiveis = await diasIndisponiveisEmLote(unit.id, dataInicio, dataFimExclusiva);
      /* productId vai DENTRO de cada item (nao uma vez so no topo), e produtos
         "Time Period" tem de incluir openingTimes por item -- confirmado ao
         vivo pelo self-testing tool (2026-08-18). O SalDesk nao guarda
         horario de funcionamento por unidade, por isso usa-se sempre o dia
         inteiro (00:00-23:59), tal como a propria documentacao descreve
         para "opening times spanning the full day". O nome do campo e
         "availabilities" (plural) -- ver comentario do topo do ficheiro.
         openingTimes e um ARRAY de intervalos (nao um objecto unico) --
         confirmado pelo erro exacto de desserializacao Jackson do
         self-testing tool (2026-08-20): DTO real e
         ArrayList<SupplierApiAvailabilityOpeningTimesDTO>. */
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
    }

    return res.status(200).json({ data: { availabilities } });
  } catch (err) {
    next(err);
  }
}

/* Soma os "count" de bookingItems e valida que todas as categorias sao
   vendiveis -- usado por reserve e por book (o spec garante que os
   bookingItems de book replicam os de reserve, por isso a mesma validacao
   serve para os dois). total:null indica falha; invalidCategory identifica
   qual categoria foi rejeitada -- o self-testing tool da GYG (2026-08-20)
   confirmou que a resposta INVALID_TICKET_CATEGORY exige um campo
   "ticketCategory" com esse valor, nao so o errorCode/errorMessage. */
function validarBookingItems(bookingItems) {
  if (!Array.isArray(bookingItems) || bookingItems.length === 0) return { total: null, invalidCategory: null };
  let total = 0;
  for (const item of bookingItems) {
    if (!SUPPORTED_TICKET_CATEGORIES.includes(item.category)) return { total: null, invalidCategory: item.category };
    total += Number(item.count) || 0;
  }
  if (total <= 0) return { total: null, invalidCategory: null };
  return { total, invalidCategory: null };
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

    const { total: totalParticipantes, invalidCategory } = validarBookingItems(bookingItems);
    if (totalParticipantes === null) {
      return erro(res, 'INVALID_TICKET_CATEGORY', 'One or more requested ticket categories are not sellable.',
        invalidCategory ? { ticketCategory: invalidCategory } : {});
    }

    const unit = await encontrarUnidadePorProduto(productId);
    if (!unit) {
      return erro(res, 'INVALID_PRODUCT', 'This product does not exist or is not sellable.');
    }

    /* dateTime chega como string, ex. "2026-09-01T00:00:00-01:00" (Time
       Period, sempre meia-noite) ou "2026-09-01T14:00:00-01:00" (Time
       point, hora real do slot). Extraido directamente da string (ver
       extrairDataHoraLocal) -- nunca via new Date().toISOString(), que
       normaliza para UTC e podia devolver o dia errado perto da meia-noite. */
    const { date: dateFrom, time: horaPedida } = extrairDataHoraLocal(dateTime);
    if (!dateFrom) {
      return erro(res, 'VALIDATION_FAILURE', 'dateTime must be a valid ISO 8601 datetime.');
    }
    const diaSeguinte = new Date(dateFrom + 'T00:00:00Z'); diaSeguinte.setUTCDate(diaSeguinte.getUTCDate() + 1);
    const dateTo = diaSeguinte.toISOString().split('T')[0];

    /* "Change ticket quantities on existing Booking" -- a GYG reserva de novo
       (novo hold) com o MESMO gygBookingReference de uma reserva ja
       confirmada, para depois chamar /book outra vez com a quantidade
       actualizada. Sem excluir a reserva actual dessa mesma referencia da
       verificacao de disponibilidade, isto colidia sempre consigo mesmo
       (NO_AVAILABILITY) -- confirmado pelo self-testing tool (2026-08-20). */
    const { data: holdExistente } = await supabaseAdmin
      .from('ota_reservation_holds')
      .select('reservation_id')
      .eq('channel', 'getyourguide')
      .eq('external_ref', gygBookingReference)
      .eq('status', 'booked')
      .not('reservation_id', 'is', null)
      .maybeSingle();

    /* Time point -- o slot pedido tem de bater certo com um dos horarios
       configurados da unidade, com capacidade partilhada (varias reservas
       cabem ate ao limite do slot), mesma logica ja usada no motor interno
       (publicController.criarReserva) e no booking do staff. */
    const unitMetaReserve = parseUnitMeta(unit);
    const activitySlotsReserve = Array.isArray(unitMetaReserve.time_slots) ? unitMetaReserve.time_slots : [];
    let holdStartTime = null;
    if (activitySlotsReserve.length > 0) {
      const slotEscolhido = activitySlotsReserve.find((s) => normalizarHora(s.time) === normalizarHora(horaPedida));
      if (!slotEscolhido) {
        return erro(res, 'NO_AVAILABILITY', 'This time slot is not available for this activity.');
      }
      holdStartTime = slotEscolhido.time;
      const cabe = await verificarDisponibilidadeSlot(supabaseAdmin, unit.id, dateFrom, slotEscolhido.time, totalParticipantes, Number(slotEscolhido.capacity) || 0, holdExistente?.reservation_id || null);
      if (!cabe) {
        return erro(res, 'NO_AVAILABILITY', 'This activity is sold out for the requested date.');
      }
    } else {
      const disponivel = await verificarDisponibilidade(supabaseAdmin, unit.id, dateFrom, dateTo, holdExistente?.reservation_id || null);
      if (!disponivel) {
        return erro(res, 'NO_AVAILABILITY', 'This activity is sold out for the requested date.');
      }
    }

    /* calcularPreco devolve o preco de UM dia para a unidade (nao multiplica
       por pessoas) -- mesma convencao ja usada em publicController.criarReserva
       e reservationsController.criar (nao ha ainda preco diferenciado por
       categoria de bilhete em lado nenhum do motor de precos, so um
       base_price por unidade, por isso ADULT e CHILD contam da mesma forma
       aqui, tal como no resto da app). */
    const { total: precoDia } = calcularPreco(unit, dateFrom, dateTo);
    const total = Math.round(precoDia * totalParticipantes * 100) / 100;
    /* .toISOString() traz milissegundos (".388Z"); a BD depois devolve isto
       reformatado como "+00:00" em vez de "Z" ao ler de volta -- o self-testing
       tool da GYG rejeitou esse formato como "Invalid datetime string" para
       reservationExpiration. Corta os milissegundos aqui e usa este MESMO
       valor (nunca o devolvido pela BD) tanto para gravar como para responder,
       igual ao formato ja aceite pela GYG em queryAvailability's dateTime. */
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

    const { data: hold, error } = await supabaseAdmin
      .from('ota_reservation_holds')
      .insert({
        operator_id:  unit.operators.id,
        unit_id:      unit.id,
        channel:      'getyourguide',
        external_ref: gygBookingReference,
        check_in:     dateFrom,
        check_out:    dateTo,
        start_time:   holdStartTime,
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
        reservationExpiration: expiresAt,
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
    const { total: totalBook, invalidCategory: invalidCategoryBook } = validarBookingItems(bookingItems);
    if (totalBook === null) {
      return erro(res, 'INVALID_TICKET_CATEGORY', 'One or more requested ticket categories are not sellable.',
        invalidCategoryBook ? { ticketCategory: invalidCategoryBook } : {});
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

    /* Se ja existia uma reserva confirmada com este MESMO gygBookingReference
       (fluxo "mudar quantidade de bilhetes"), esta nova reserva substitui-a --
       cancela a antiga ANTES de inserir a nova (reservations_no_overlap,
       database/040, rejeitava sempre a nova insercao se a antiga ainda
       estivesse activa nessa mesma data -- confirmado pelo self-testing
       tool, 2026-08-20). reservations nao tem estado "superseded", so
       "cancelled", que reflecte com precisao suficiente o resultado real. */
    const { data: holdAntigo } = await supabaseAdmin
      .from('ota_reservation_holds')
      .select('id, reservation_id')
      .eq('channel', 'getyourguide')
      .eq('external_ref', gygBookingReference)
      .eq('status', 'booked')
      .neq('id', hold.id)
      .not('reservation_id', 'is', null)
      .maybeSingle();

    if (holdAntigo?.reservation_id) {
      await supabaseAdmin.from('reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', holdAntigo.reservation_id);
      await supabaseAdmin.from('ota_reservation_holds')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', holdAntigo.id);
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
        start_time:     hold.start_time,
        guests:         hold.participants,
        total_price:    hold.total_price,
        status:         'confirmed',
        source:         'getyourguide',
        notes:          `GYG booking ref: ${gygBookingReference}. Comment: ${comment}`,
      })
      .select()
      .single();

    if (error) {
      /* Se ja tinha sido cancelada a reserva antiga (substituicao) e esta
         insercao nova falhou por qualquer motivo, reactivar a antiga -- nunca
         deixar o cliente sem reserva nenhuma so porque a tentativa de mudar
         quantidade nao completou. */
      if (holdAntigo?.reservation_id) {
        await supabaseAdmin.from('reservations')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', holdAntigo.reservation_id);
        await supabaseAdmin.from('ota_reservation_holds')
          .update({ status: 'booked', updated_at: new Date().toISOString() })
          .eq('id', holdAntigo.id);
      }
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
    .select('capacity, ota_product_ids, description')
    .eq('id', unitId)
    .maybeSingle();

  const productId = unit?.ota_product_ids?.getyourguide;
  if (!productId) return; // unidade nao ligada ao GYG

  const hoje = new Date();
  const dataInicio = hoje.toISOString().split('T')[0];
  const dataFimExclusivaStr = new Date(hoje.getTime() + 90 * 86400000).toISOString().split('T')[0];

  const unitMetaNotify = parseUnitMeta(unit);
  const activitySlots = Array.isArray(unitMetaNotify.time_slots) ? unitMetaNotify.time_slots : [];
  const availabilities = [];

  if (activitySlots.length > 0) {
    const ocupacao = await ocupacaoSlotsEmLote(supabaseAdmin, unitId, dataInicio, dataFimExclusivaStr);
    for (let i = 0; i < 90; i++) {
      const dia = new Date(hoje.getTime() + i * 86400000);
      const dataStr = dia.toISOString().split('T')[0];
      const ocupadosPorHora = ocupacao[dataStr] || {};
      for (const slot of activitySlots) {
        const ocupados = ocupadosPorHora[normalizarHora(slot.time)] || 0;
        availabilities.push({
          dateTime:  `${dataStr}T${slot.time}:00-01:00`,
          vacancies: Math.max(0, (Number(slot.capacity) || 0) - ocupados),
        });
      }
    }
  } else {
    const indisponiveis = await diasIndisponiveisEmLote(unitId, dataInicio, dataFimExclusivaStr);
    for (let i = 0; i < 90; i++) {
      const dia = new Date(hoje.getTime() + i * 86400000);
      const dataStr = dia.toISOString().split('T')[0];
      availabilities.push({
        dateTime:  `${dataStr}T00:00:00-01:00`,
        vacancies: indisponiveis.has(dataStr) ? 0 : (unit.capacity || 1),
      });
    }
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
