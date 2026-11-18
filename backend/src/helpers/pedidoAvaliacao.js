/* Regras do pedido de avaliacao (automatico e manual) -- funcoes puras, sem base de dados.
   Spec: docs/superpowers/specs/2026-11-18-pedido-automatico-avaliacao-design.md */
const { isPlanActive } = require('./planoActivo');

const VALIDADE_TOKEN_DIAS = 30;
/* So reservas directas: as de OTAs (GetYourGuide, Viator...) tem e-mails do intermediario
   e as regras delas proibem contactar o cliente fora da plataforma. */
const FONTES_DIRECTAS = ['public', 'manual', 'admin', 'direct'];
const ESTADOS_AVALIAVEIS = ['confirmed', 'checked_in', 'checked_out'];

const DEFAULT_TEMPLATE = {
  subject_pt: 'Como correu? Deixe a sua avaliacao',
  subject_en: 'How was it? Leave your review',
  body_pt: 'Ola {nome_cliente},\n\nObrigado por ter escolhido {nome_tour}. Esperamos que tenha corrido bem!\n\nA sua opiniao ajuda-nos e ajuda outros viajantes a escolher. Demora menos de um minuto:\n\n{link_avaliacao}\n\nObrigado!',
  body_en: 'Hello {nome_cliente},\n\nThank you for choosing {nome_tour}. We hope you had a great time!\n\nYour opinion helps us and helps other travellers choose. It takes less than a minute:\n\n{link_avaliacao}\n\nThank you!',
};

/* Dia de hoje em Cabo Verde, 'YYYY-MM-DD' */
function hojeCaboVerde(agora = new Date()) {
  return agora.toLocaleDateString('en-CA', { timeZone: 'Atlantic/Cape_Verde' });
}

/* Soma dias a uma data 'YYYY-MM-DD' (ao meio-dia UTC, para nao escorregar de dia) */
function somarDias(data, n) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* Reservas que terminaram entre ha 3 dias e ontem: a folga deixa recuperar um dia falhado */
function janelaPedidoAutomatico(agora = new Date()) {
  const hoje = hojeCaboVerde(agora);
  return { de: somarDias(hoje, -3), ate: somarDias(hoje, -1) };
}

/* A reserva pode receber o pedido automatico? (a existencia de avaliacao e verificada a parte) */
function reservaElegivel(reserva, operador, { de, ate, internoId } = {}) {
  if (!reserva || !operador) return false;
  if (!ESTADOS_AVALIAVEIS.includes(reserva.status)) return false;
  if (reserva.source && !FONTES_DIRECTAS.includes(reserva.source)) return false;
  if (!String(reserva.customer_email || '').trim()) return false;
  const fim = String(reserva.check_out || '').slice(0, 10);
  if (!fim || fim < de || fim > ate) return false;
  if (operador.review_auto_request === false) return false;
  if (operador.is_demo) return false;
  if (internoId && operador.id === internoId) return false;
  return isPlanActive(operador);
}

/* Um viajante com conta pode avaliar quando a reserva ja terminou (mesmo sem check-out) */
function podeAvaliarViajante(reserva, hoje) {
  if (!reserva || !ESTADOS_AVALIAVEIS.includes(reserva.status)) return false;
  const fim = String(reserva.check_out || '').slice(0, 10);
  return !!fim && fim < hoje;
}

/* Estado de um link de avaliacao: 'ok', 'expirado' ou 'invalido' (ja usado, substituido ou inexistente) */
function estadoDoToken(review, agora = new Date()) {
  if (!review || !review.review_token) return 'invalido';
  if (!review.token_expires_at || new Date(review.token_expires_at) <= agora) return 'expirado';
  return 'ok';
}

function preencherModelo(texto, { nome_cliente, nome_tour, link } = {}) {
  return String(texto || '')
    .replace(/{nome_cliente}/g, nome_cliente || '')
    .replace(/{nome_tour}/g, nome_tour || '')
    .replace(/{link_avaliacao}/g, link || '');
}

module.exports = {
  VALIDADE_TOKEN_DIAS,
  FONTES_DIRECTAS,
  ESTADOS_AVALIAVEIS,
  DEFAULT_TEMPLATE,
  hojeCaboVerde,
  janelaPedidoAutomatico,
  reservaElegivel,
  podeAvaliarViajante,
  estadoDoToken,
  preencherModelo,
};
