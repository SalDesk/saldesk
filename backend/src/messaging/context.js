/* Dados da reserva que alimentam as variaveis das mensagens (guia, link de avaliacao). */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { frontendBase } = require('../utils/urls');

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

/* Link de avaliacao da reserva (mesma mecanica do pedido de avaliacao por email:
   um token por reserva, valido 7 dias). Gerar um novo invalida o anterior, por isso so
   se chama quando a mensagem vai mesmo ser criada. */
async function criarLinkAvaliacao(operatorId, reserva) {
  const token = crypto.randomBytes(20).toString('hex');
  const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from('reviews').upsert({
    operator_id: operatorId, reservation_id: reserva.id, customer_id: reserva.customer_id || null,
    review_token: token, token_expires_at: expira, rating: null, is_public: false,
  }, { onConflict: 'reservation_id' });
  if (error) throw error;
  return `${frontendBase()}/review/${token}`;
}

module.exports = { nomeDoGuia, criarLinkAvaliacao };
