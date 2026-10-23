/* Templates das mensagens de WhatsApp.

   Cada operador pode personalizar o texto (tabela message_templates); sem linha,
   usa-se o texto por omissao daqui. As variaveis sao as mesmas das automacoes
   (helpers/automationTemplate.js): {nome_cliente} {nome_tour} {data} {hora} {guia}
   {ponto_encontro} {operador} {link_avaliacao}. As linhas do guia e do ponto de
   encontro desaparecem sozinhas quando nao ha valor.

   Fase 1: so PT e EN. DE e NL entram quando customers.language os aceitar. */

const { supabaseAdmin } = require('../config/supabase');
const { variaveisDesconhecidas, usaVariavel } = require('../helpers/automationTemplate');

const GATILHOS = ['booking_confirmed', 'reminder_d1', 'review_request'];
const IDIOMAS = ['pt', 'en'];

const POR_OMISSAO = {
  booking_confirmed: {
    pt: 'Olá {nome_cliente}! A sua reserva de {nome_tour} em {data} às {hora} está confirmada.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nQualquer dúvida, responda a esta mensagem. Obrigado por escolher {operador}!',
    en: 'Hello {nome_cliente}! Your booking for {nome_tour} on {data} at {hora} is confirmed.\n\nMeeting point: {ponto_encontro}\nGuide: {guia}\n\nIf you have any questions, just reply to this message. Thank you for choosing {operador}!',
  },
  reminder_d1: {
    pt: 'Olá {nome_cliente}! Um lembrete: amanhã, {data}, tem {nome_tour} às {hora}.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nSe precisar de alterar alguma coisa, responda a esta mensagem. Até amanhã!',
    en: 'Hello {nome_cliente}! A reminder: tomorrow, {data}, you have {nome_tour} at {hora}.\n\nMeeting point: {ponto_encontro}\nGuide: {guia}\n\nIf you need to change anything, just reply to this message. See you tomorrow!',
  },
  review_request: {
    pt: 'Olá {nome_cliente}! Esperamos que tenha gostado de {nome_tour}. A sua opinião ajuda-nos muito, pode deixá-la aqui:\n{link_avaliacao}\n\nObrigado, {operador}',
    en: 'Hello {nome_cliente}! We hope you enjoyed {nome_tour}. Your feedback helps us a lot, you can leave it here:\n{link_avaliacao}\n\nThank you, {operador}',
  },
};

/* Estados da reserva em que cada mensagem faz sentido. */
const ESTADOS_PERMITIDOS = {
  booking_confirmed: ['confirmed', 'checked_in'],
  reminder_d1: ['confirmed'],
  // So depois da actividade concluida, nunca por horario fixo.
  review_request: ['checked_out'],
};

function idiomaValido(l) {
  return IDIOMAS.includes(l) ? l : 'pt';
}

function corpoPorOmissao(gatilho, idioma) {
  return POR_OMISSAO[gatilho]?.[idiomaValido(idioma)] || null;
}

/* Texto a usar: o do operador, ou o por omissao. */
async function obterCorpo(operatorId, gatilho, idioma) {
  const loc = idiomaValido(idioma);
  const { data } = await supabaseAdmin
    .from('message_templates')
    .select('body')
    .eq('operator_id', operatorId).eq('trigger', gatilho).eq('locale', loc)
    .maybeSingle();
  return data?.body?.trim() || corpoPorOmissao(gatilho, loc);
}

/* Todos os gatilhos x idiomas, a indicar quais estao personalizados. */
async function listarTemplates(operatorId) {
  const { data } = await supabaseAdmin
    .from('message_templates')
    .select('trigger, locale, body')
    .eq('operator_id', operatorId);
  const custom = new Map((data || []).map((r) => [`${r.trigger}:${r.locale}`, r.body]));
  const out = [];
  for (const trigger of GATILHOS) {
    for (const locale of IDIOMAS) {
      const body = custom.get(`${trigger}:${locale}`);
      out.push({ trigger, locale, body: body || corpoPorOmissao(trigger, locale), custom: !!body, default_body: corpoPorOmissao(trigger, locale) });
    }
  }
  return out;
}

/* Recusa o que chegaria ao cliente estragado: variaveis que nao existem, ou um pedido de
   avaliacao sem o link (a mensagem perderia o sentido). */
function validarTexto(gatilho, texto) {
  const desconhecidas = variaveisDesconhecidas(texto);
  if (desconhecidas.length) {
    const err = new Error(`Variavel desconhecida: ${desconhecidas.join(', ')}`);
    err.status = 400;
    err.code = 'UNKNOWN_VARIABLE';
    err.variables = desconhecidas;
    throw err;
  }
  if (gatilho === 'review_request' && !usaVariavel(texto, 'link_avaliacao')) {
    const err = new Error('O pedido de avaliacao tem de incluir {link_avaliacao}');
    err.status = 400;
    err.code = 'MISSING_REVIEW_LINK';
    throw err;
  }
}

/* body vazio = volta ao texto por omissao. */
async function guardarTemplate(operatorId, gatilho, idioma, body) {
  if (!GATILHOS.includes(gatilho) || !IDIOMAS.includes(idioma)) {
    const err = new Error('Gatilho ou idioma invalido');
    err.status = 400;
    err.code = 'INVALID_TEMPLATE';
    throw err;
  }
  const texto = String(body || '').trim();
  if (!texto) {
    await supabaseAdmin.from('message_templates')
      .delete().eq('operator_id', operatorId).eq('trigger', gatilho).eq('locale', idioma);
    return { custom: false, body: corpoPorOmissao(gatilho, idioma) };
  }
  if (texto.length > 1000) {
    const err = new Error('Mensagem demasiado longa (maximo 1000 caracteres)');
    err.status = 400;
    err.code = 'TEMPLATE_TOO_LONG';
    throw err;
  }
  validarTexto(gatilho, texto);
  const { error } = await supabaseAdmin.from('message_templates').upsert({
    operator_id: operatorId, trigger: gatilho, locale: idioma, body: texto, updated_at: new Date().toISOString(),
  }, { onConflict: 'operator_id,trigger,locale' });
  if (error) throw error;
  return { custom: true, body: texto };
}

module.exports = { GATILHOS, IDIOMAS, ESTADOS_PERMITIDOS, POR_OMISSAO, idiomaValido, corpoPorOmissao, obterCorpo, listarTemplates, guardarTemplate, validarTexto };
