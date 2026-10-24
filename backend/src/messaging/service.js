/* API interna da camada de mensagens. Os modulos de negocio chamam isto e nunca escolhem
   o adapter nem falam com o WhatsApp.

   enviarParaReserva:    accao de uma pessoa no painel (botao "Enviar por WhatsApp").
   enfileirarAutomacao:  mensagem de uma automacao (cron), entra na outbox e o worker trata. */

const { supabaseAdmin } = require('../config/supabase');
const { renderTemplate } = require('../helpers/automationTemplate');
const { detectarIdioma } = require('../helpers/languageHelper');
const { nomeDoGuia, criarLinkAvaliacao } = require('./context');
const { GATILHOS, ESTADOS_PERMITIDOS, idiomaValido, obterCorpo } = require('./templates');
const { enfileirar, resolverAgora, erro } = require('./outbox');
const { paramsPara } = require('./metaTemplates');

const ROTULOS_GATILHO = {
  booking_confirmed: 'a confirmacao',
  reminder_d1: 'o lembrete',
  review_request: 'o pedido de avaliacao',
};

async function carregarReserva(operatorId, reservationId) {
  const { data } = await supabaseAdmin
    .from('reservations')
    .select('id, status, customer_id, customer_name, customer_phone, customer_country, check_in, check_out, start_time, total_price, whatsapp_opt_in, customers(language, phone), units(name)')
    .eq('id', reservationId).eq('operator_id', operatorId)
    .maybeSingle();
  return data || null;
}

async function linhaExistente(operatorId, dedupeKey) {
  const { data } = await supabaseAdmin
    .from('message_outbox')
    .select('id, status, handoff_url, opened_at')
    .eq('operator_id', operatorId).eq('dedupe_key', dedupeKey)
    .maybeSingle();
  return data || null;
}

async function enviarParaReserva({ operatorId, reservationId, trigger, resend = false }) {
  if (!GATILHOS.includes(trigger)) throw erro(400, 'INVALID_TRIGGER', 'Tipo de mensagem invalido');

  const reserva = await carregarReserva(operatorId, reservationId);
  if (!reserva) throw erro(404, 'NOT_FOUND', 'Reserva nao encontrada');

  if (!ESTADOS_PERMITIDOS[trigger].includes(reserva.status)) {
    throw erro(409, 'STATE_NOT_ALLOWED', `Nao e possivel enviar ${ROTULOS_GATILHO[trigger]} com a reserva em "${reserva.status}"`);
  }

  // Idempotente: o mesmo gatilho para a mesma reserva devolve a mensagem que ja existe.
  const chaveBase = `${reserva.id}:${trigger}`;
  const existente = await linhaExistente(operatorId, chaveBase);
  if (existente && !resend && existente.status !== 'cancelled') {
    return { id: existente.id, status: existente.status, url: existente.handoff_url, opened: !!existente.opened_at, created: false, automatico: !existente.handoff_url };
  }
  const dedupeKey = existente ? `${chaveBase}:r${Date.now()}` : chaveBase;

  const idioma = idiomaValido(reserva.customers?.language || detectarIdioma(reserva.customer_country));
  const { data: operador } = await supabaseAdmin.from('operators').select('name').eq('id', operatorId).maybeSingle();

  const dados = {
    customer_name: reserva.customer_name,
    unit_name: reserva.units?.name,
    check_in: reserva.check_in,
    check_out: reserva.check_out,
    start_time: reserva.start_time,
    total_price: reserva.total_price,
    operator_name: operador?.name,
    guide_name: await nomeDoGuia(reserva.id),
  };
  if (trigger === 'review_request') dados.review_link = await criarLinkAvaliacao(operatorId, reserva);

  const corpo = await obterCorpo(operatorId, trigger, idioma);
  const text = renderTemplate(corpo, dados);

  const enq = await enfileirar({
    operatorId,
    bookingId: reserva.id,
    trigger,
    to: reserva.customer_phone || reserva.customers?.phone,
    locale: idioma,
    text,
    display: { customerName: reserva.customer_name, tourName: reserva.units?.name || null, date: reserva.check_in },
    dedupeKey,
    manual: true,
    // Cloud API: so com o consentimento do cliente; fora da janela de 24 h vai por template (valores ordenados)
    optIn: reserva.whatsapp_opt_in === true,
    templateParams: paramsPara(trigger, dados, idioma),
  });
  // wa.me e so um link (sem rede): resolve-se logo. Cloud API/OpenWA falam com a rede: ficam na fila para o worker
  // enviar (nenhuma chamada ao WhatsApp dentro de um pedido do utilizador).
  const automatico = enq.provider !== 'wame';
  const linha = automatico ? null : await resolverAgora(operatorId, enq.id);
  return { id: enq.id, status: linha?.status || 'queued', url: linha?.handoff_url || null, opened: !!linha?.opened_at, created: enq.created, automatico };
}

/* Mensagem ja renderizada por uma automacao. O dedupe impede enviar duas vezes a mesma
   automacao para a mesma reserva. */
async function enfileirarAutomacao({ operatorId, reservationId, automationId, to, locale, text, display }) {
  return enfileirar({
    operatorId,
    bookingId: reservationId,
    trigger: 'automation',
    to,
    locale: idiomaValido(locale),
    text,
    display,
    dedupeKey: `${reservationId}:auto:${automationId}`,
    manual: false,
  });
}

module.exports = { enviarParaReserva, enfileirarAutomacao };
