/* Biblioteca de templates da Meta (WhatsApp Cloud API), mantida pela Wandr e reutilizada por todos os operadores.

   Fora da janela de 24 h a Meta so deixa enviar templates aprovados, com variaveis posicionais {{1}}, {{2}}...
   (nao ha linhas condicionais como no texto livre: por isso estes textos nao tem guia nem ponto de encontro).
   Cada WABA aprova os seus: a ligacao de um operador submete estes mesmos textos na conta dele.

   Regras da Meta que o codigo respeita: variaveis numeradas em sequencia, o texto nao pode comecar nem acabar
   numa variavel, cada variavel leva um exemplo, e os valores nao levam quebras de linha, tabulacoes nem mais de
   4 espacos seguidos. Pedidos de avaliacao contam como MARKETING (custa mais e pesa na qualidade do numero). */

const { formatarData, formatarHora } = require('../helpers/automationTemplate');

const CODIGO_IDIOMA = { pt: 'pt_PT', en: 'en' };

/* params: ordem das variaveis {{1}}.. (chaves de "dados", ver paramsPara). */
const DEFINICOES = [
  {
    trigger: 'booking_confirmed',
    name: 'saldesk_confirmacao_reserva_v1',
    category: 'UTILITY',
    params: ['nome', 'tour', 'data', 'hora', 'operador'],
    locales: {
      pt: {
        body: 'Olá {{1}}! A sua reserva de {{2}} em {{3}} às {{4}} está confirmada. Se tiver alguma dúvida, responda a esta mensagem. Obrigado por escolher {{5}}!',
        exemplos: ['Maria', 'Passeio de Barco', '15/12/2026', '17:30', 'Logan Tours'],
      },
      en: {
        body: 'Hello {{1}}! Your booking for {{2}} on {{3}} at {{4}} is confirmed. If you have any questions, just reply to this message. Thank you for choosing {{5}}!',
        exemplos: ['Maria', 'Boat Trip', '15/12/2026', '17:30', 'Logan Tours'],
      },
    },
  },
  {
    trigger: 'reminder_d1',
    name: 'saldesk_lembrete_vespera_v1',
    category: 'UTILITY',
    params: ['nome', 'data', 'tour', 'hora'],
    locales: {
      pt: {
        body: 'Olá {{1}}! Um lembrete: amanhã, {{2}}, tem {{3}} às {{4}}. Se precisar de alterar alguma coisa, responda a esta mensagem. Até amanhã!',
        exemplos: ['Maria', '15/12/2026', 'Passeio de Barco', '17:30'],
      },
      en: {
        body: 'Hello {{1}}! A reminder: tomorrow, {{2}}, you have {{3}} at {{4}}. If you need to change anything, just reply to this message. See you tomorrow!',
        exemplos: ['Maria', '15/12/2026', 'Boat Trip', '17:30'],
      },
    },
  },
  {
    trigger: 'review_request',
    name: 'saldesk_pedido_avaliacao_v1',
    category: 'MARKETING',
    params: ['nome', 'tour', 'link', 'operador'],
    locales: {
      pt: {
        body: 'Olá {{1}}! Esperamos que tenha gostado de {{2}}. A sua opinião ajuda-nos muito, pode deixá-la aqui: {{3}} Obrigado, {{4}}.',
        exemplos: ['Maria', 'Passeio de Barco', 'https://app.saldesk.cv/review/abc123', 'Logan Tours'],
      },
      en: {
        body: 'Hello {{1}}! We hope you enjoyed {{2}}. Your feedback helps us a lot, you can leave it here: {{3}} Thank you, {{4}}.',
        exemplos: ['Maria', 'Boat Trip', 'https://app.saldesk.cv/review/abc123', 'Logan Tours'],
      },
    },
  },
];

function definicaoDoGatilho(trigger) {
  return DEFINICOES.find((d) => d.trigger === trigger) || null;
}

/* A Meta recusa valores com quebras de linha, tabulacoes ou mais de 4 espacos seguidos, e vazios. */
function sanitizarParametro(valor, vazio = '-') {
  const s = String(valor ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {5,}/g, '    ').trim();
  return (s || vazio).slice(0, 1024);
}

/* Valores por ordem das variaveis do template, a partir dos mesmos dados das mensagens de texto livre. */
function paramsPara(trigger, dados, locale = 'pt') {
  const def = definicaoDoGatilho(trigger);
  if (!def) return null;
  const aCombinar = locale === 'en' ? 'to be confirmed' : 'a combinar';
  const valores = {
    nome: dados.customer_name,
    tour: dados.unit_name,
    data: formatarData(dados.check_in),
    hora: formatarHora(dados.start_time) || aCombinar,
    operador: dados.operator_name,
    link: dados.review_link,
  };
  return def.params.map((k) => sanitizarParametro(valores[k]));
}

/* Corpo do pedido de criacao de template (POST /{waba-id}/message_templates). */
function paraSubmeter(def, locale) {
  const l = def.locales[locale];
  if (!l) return null;
  return {
    name: def.name,
    language: CODIGO_IDIOMA[locale],
    category: def.category,
    components: [{ type: 'BODY', text: l.body, example: { body_text: [l.exemplos] } }],
  };
}

/* Verificacao das regras da Meta sobre o texto (usada nos testes e antes de submeter). Devolve a lista de problemas. */
function problemasDoTexto(body, nParams, nExemplos) {
  const problemas = [];
  const marcas = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  if (marcas.length !== nParams) problemas.push(`tem ${marcas.length} variaveis, esperava ${nParams}`);
  marcas.forEach((n, i) => { if (n !== i + 1) problemas.push(`variavel fora de ordem: {{${n}}} na posicao ${i + 1}`); });
  if (/^\s*\{\{\d+\}\}/.test(body)) problemas.push('comeca numa variavel');
  if (/\{\{\d+\}\}\s*$/.test(body)) problemas.push('acaba numa variavel');
  if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(body)) problemas.push('duas variaveis seguidas');
  if (nExemplos !== nParams) problemas.push(`${nExemplos} exemplos para ${nParams} variaveis`);
  if (body.length > 1024) problemas.push('corpo com mais de 1024 caracteres');
  return problemas;
}

module.exports = { DEFINICOES, CODIGO_IDIOMA, definicaoDoGatilho, sanitizarParametro, paramsPara, paraSubmeter, problemasDoTexto };
