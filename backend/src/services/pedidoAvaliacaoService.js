/* Pedido de avaliacao por e-mail: o mesmo codigo serve o pedido manual do operador
   (POST /reviews/request) e a tarefa diaria automatica (cronService, 10:00 Cabo Verde).
   Regras em helpers/pedidoAvaliacao.js; spec em
   docs/superpowers/specs/2026-11-18-pedido-automatico-avaliacao-design.md */
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { enviarEmail } = require('../helpers/emailHelper');
const { detectarIdioma } = require('../helpers/languageHelper');
const { frontendBase } = require('../utils/urls');
const {
  VALIDADE_TOKEN_DIAS, ESTADOS_AVALIAVEIS, DEFAULT_TEMPLATE,
  janelaPedidoAutomatico, reservaElegivel, preencherModelo,
} = require('../helpers/pedidoAvaliacao');

/* Cria (ou renova, se ainda ninguem respondeu) o pedido da reserva e envia o e-mail.
   Nunca toca numa avaliacao ja dada. Uma falha de envio nao desfaz o pedido: o enviarEmail
   guarda-a em email_failures e o emailRetryService volta a tentar com o mesmo link. */
async function enviarPedido(reserva, { operadorId }) {
  if (!String(reserva.customer_email || '').trim()) return { ok: false, code: 'NO_EMAIL' };

  const { data: existente } = await supabaseAdmin
    .from('reviews').select('id, rating').eq('reservation_id', reserva.id).maybeSingle();
  if (existente && existente.rating !== null && existente.rating !== undefined) {
    return { ok: false, code: 'ALREADY_REVIEWED' };
  }

  const token = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + VALIDADE_TOKEN_DIAS * 24 * 60 * 60 * 1000).toISOString();
  /* rating fica null e is_public false ate o cliente responder: um pedido nao e uma avaliacao */
  const { error } = await supabaseAdmin.from('reviews').upsert({
    operator_id: operadorId, reservation_id: reserva.id, customer_id: reserva.customer_id || null,
    review_token: token, token_expires_at: expires, rating: null, is_public: false,
  }, { onConflict: 'reservation_id' });
  if (error) throw error;

  const link = `${frontendBase()}/review/${token}`;
  const { data: modelo } = await supabaseAdmin
    .from('review_request_templates').select('*').eq('operator_id', operadorId).maybeSingle();
  const lang = detectarIdioma(reserva.customer_country) === 'en' ? 'en' : 'pt';
  /* campo do modelo do operador vazio cai para o texto por omissao */
  const campo = (nome) => (modelo && String(modelo[nome] || '').trim()) ? modelo[nome] : DEFAULT_TEMPLATE[nome];
  const dados = { nome_cliente: reserva.customer_name, nome_tour: reserva.units && reserva.units.name, link };

  try {
    await enviarEmail({
      to: reserva.customer_email,
      subject: preencherModelo(campo(`subject_${lang}`), dados),
      text: preencherModelo(campo(`body_${lang}`), dados),
    });
  } catch {
    /* a fila de reenvio do enviarEmail trata a falha */
  }
  return { ok: true, token, link };
}

/* Tarefa diaria: pede avaliacao as reservas directas que terminaram entre ha 3 dias e ontem */
async function enviarPedidosAutomaticos(agora = new Date()) {
  const janela = janelaPedidoAutomatico(agora);
  const { data: reservas, error } = await supabaseAdmin
    .from('reservations')
    .select('id, operator_id, status, source, customer_name, customer_email, customer_id, customer_country, check_out, units(name)')
    .gte('check_out', janela.de)
    .lte('check_out', janela.ate)
    .in('status', ESTADOS_AVALIAVEIS);
  if (error) throw error;
  const lista = reservas || [];
  if (!lista.length) {
    console.log('[Avaliacoes] pedidos automaticos: 0 enviados, 0 ignorados');
    return { enviados: 0, ignorados: 0 };
  }

  const operadorIds = [...new Set(lista.map((r) => r.operator_id))];
  const [{ data: operadores }, { data: jaPedidas }] = await Promise.all([
    supabaseAdmin.from('operators')
      .select('id, review_auto_request, is_demo, plan_status, trial_ends_at, plan_paid_until')
      .in('id', operadorIds),
    supabaseAdmin.from('reviews').select('reservation_id').in('reservation_id', lista.map((r) => r.id)),
  ]);
  const porId = new Map((operadores || []).map((o) => [o.id, o]));
  const comPedido = new Set((jaPedidas || []).map((r) => r.reservation_id));
  const regras = { ...janela, internoId: process.env.WANDR_INTERNAL_OPERATOR_ID };

  let enviados = 0;
  let ignorados = 0;
  for (const r of lista) {
    if (comPedido.has(r.id) || !reservaElegivel(r, porId.get(r.operator_id), regras)) { ignorados += 1; continue; }
    try {
      const res = await enviarPedido(r, { operadorId: r.operator_id });
      if (res.ok) enviados += 1; else ignorados += 1;
    } catch (err) {
      ignorados += 1;
      console.error('[Avaliacoes] erro ao criar pedido:', err.message);
    }
  }
  console.log(`[Avaliacoes] pedidos automaticos: ${enviados} enviados, ${ignorados} ignorados`);
  return { enviados, ignorados };
}

module.exports = { enviarPedido, enviarPedidosAutomaticos };
