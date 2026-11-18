/* Dados da reserva que alimentam as variaveis das mensagens (guia, link de avaliacao). */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { frontendBase } = require('../utils/urls');
const { VALIDADE_TOKEN_DIAS, estadoDoToken } = require('../helpers/pedidoAvaliacao');

/* Nome do guia atribuido a esta reserva (job_assignments, papel "guide").
   Se nao houver, ou a consulta falhar, devolve '' e a frase do guia sai da mensagem. */
async function nomeDoGuia(reservaId) {
  try {
    const { data } = await supabaseAdmin
      .from('job_assignments')
      .select('staff(name)')
      .eq('reservation_id', reservaId)
      .eq('role', 'guide')
      .order('assigned_at', { ascending: true })
      .limit(1);
    return data?.[0]?.staff?.name || '';
  } catch (_) {
    return '';
  }
}

/* Link de avaliacao da reserva (mesma mecanica do pedido por email: um token por reserva,
   valido 30 dias). Nunca apaga uma avaliacao ja dada (409 ALREADY_REVIEWED) e, se ja ha um
   pedido por responder ainda valido (ex.: o e-mail automatico), reaproveita o mesmo link em
   vez de o invalidar. So se chama quando a mensagem vai mesmo ser criada. */
async function criarLinkAvaliacao(operatorId, reserva) {
  const { data: existente } = await supabaseAdmin
    .from('reviews').select('id, rating, review_token, token_expires_at')
    .eq('reservation_id', reserva.id).maybeSingle();
  if (existente && existente.rating !== null && existente.rating !== undefined) {
    const err = new Error('Esta reserva ja foi avaliada');
    err.status = 409;
    err.code = 'ALREADY_REVIEWED';
    throw err;
  }
  if (existente && estadoDoToken(existente, new Date()) === 'ok') {
    return `${frontendBase()}/review/${existente.review_token}`;
  }

  const token = crypto.randomBytes(20).toString('hex');
  const expira = new Date(Date.now() + VALIDADE_TOKEN_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from('reviews').upsert({
    operator_id: operatorId, reservation_id: reserva.id, customer_id: reserva.customer_id || null,
    review_token: token, token_expires_at: expira, rating: null, is_public: false,
  }, { onConflict: 'reservation_id' });
  if (error) throw error;
  return `${frontendBase()}/review/${token}`;
}

module.exports = { nomeDoGuia, criarLinkAvaliacao };
