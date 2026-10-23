/* Outbox: fonte unica da verdade do envio.

   Enfileirar e idempotente (unique operator_id + dedupe_key, na funcao messaging_enqueue).
   O worker reclama lotes vencidos, o router escolhe o adapter, send() devolve um resultado
   e planoParaResultado() (funcao pura, testada) decide o que gravar. Uma unica implementacao
   de retries e auditoria, partilhada por todos os adapters.

   Garantia: pelo menos uma vez, nao exactamente uma vez. No wa.me isto e inofensivo (repetir
   um link nao envia nada); para a Cloud API (fase 3) a reconciliacao e pelos webhooks. */

const { supabaseAdmin } = require('../config/supabase');
const { resolveProvider } = require('./router');
const { paraE164 } = require('./phone');
const { quandoEnviar } = require('./quietHours');

const MAX_TENTATIVAS = 6;

function backoffMs(n) {
  return Math.min(60_000 * 2 ** (n - 1), 3_600_000) * (0.8 + Math.random() * 0.4);
}

function erro(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

/* O que gravar na linha depois de um send(). Pura: nao toca na base de dados. */
function planoParaResultado(row, providerId, r, { agora = new Date(), maxTentativas = MAX_TENTATIVAS, backoff = backoffMs } = {}) {
  const base = { provider: providerId, updated_at: agora.toISOString() };
  switch (r?.status) {
    case 'sent':
      return { ...base, status: 'sent', provider_message_id: r.providerMessageId, last_error: null };
    case 'handoff':
      return { ...base, status: 'awaiting_human', handoff_url: r.url, last_error: null };
    case 'retry':
      if (row.attempts >= maxTentativas) {
        return { ...base, status: 'failed', last_error: `max_attempts: ${r.reason}` };
      }
      return {
        ...base,
        status: 'queued',
        next_attempt_at: new Date(agora.getTime() + (r.retryAfterMs ?? backoff(row.attempts))).toISOString(),
        last_error: r.reason,
      };
    case 'failed':
      return { ...base, status: 'failed', last_error: r.reason };
    default:
      return { ...base, status: 'failed', last_error: 'resultado_desconhecido' };
  }
}

async function obterConfig(operatorId) {
  const { data } = await supabaseAdmin.from('messaging_config').select('*').eq('operator_id', operatorId).maybeSingle();
  return data || { operator_id: operatorId, provider: 'wame', cloud_status: 'none' };
}

/* Enfileira uma mensagem ja renderizada.
   manual = true: accao de uma pessoa no painel, nao espera pelas horas silenciosas. */
async function enfileirar({ operatorId, bookingId = null, trigger, to, locale = 'pt', text, display = {}, dedupeKey, manual = false, agora = new Date() }) {
  const e164 = paraE164(to);
  if (!e164) throw erro(400, 'NO_PHONE', 'O cliente nao tem um numero de telefone valido');
  if (!text || !String(text).trim()) throw erro(400, 'EMPTY_MESSAGE', 'Mensagem vazia');

  const cfg = await obterConfig(operatorId);
  const provider = resolveProvider({ ...cfg, operator_id: operatorId });
  const payload = {
    operatorId, to: e164, kind: 'text', locale, text,
    context: { bookingId, trigger },
    display, // so para o painel (nome do cliente, tour, data)
  };
  const { data, error } = await supabaseAdmin.rpc('messaging_enqueue', {
    p_operator_id: operatorId,
    p_booking_id: bookingId,
    p_trigger: trigger,
    p_to_e164: e164,
    p_locale: locale,
    p_payload: payload,
    p_provider: provider.id,
    p_dedupe_key: dedupeKey || `${bookingId || 'sem_reserva'}:${trigger}`,
    p_next_attempt_at: (manual ? agora : quandoEnviar(trigger, agora)).toISOString(),
  });
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : data;
  return { id: linha.id, created: !!linha.created, provider: provider.id };
}

/* Processa uma linha ja reclamada (status 'sending'). */
async function processarLinha(row) {
  const cfg = await obterConfig(row.operator_id);
  const provider = resolveProvider({ ...cfg, operator_id: row.operator_id });
  let resultado;
  try {
    resultado = await provider.send({ ...row.payload, id: row.id }); // id da outbox = chave de idempotencia
  } catch (err) {
    // Excepcao = bug, nao erro esperado: volta a fila e fica registada.
    console.error('[Messaging] Excepcao no adapter', provider.id, err.message);
    resultado = { status: 'retry', reason: `excepcao: ${err.message}` };
  }
  const plano = planoParaResultado(row, provider.id, resultado);
  const { error } = await supabaseAdmin.from('message_outbox').update(plano).eq('id', row.id);
  if (error) throw error;
  if (plano.status === 'failed') {
    console.error(`[Messaging] Mensagem ${row.id} falhou: ${plano.last_error}`);
  }
  return { ...row, ...plano };
}

async function lerLinha(operatorId, id) {
  const { data } = await supabaseAdmin.from('message_outbox').select('*').eq('id', id).eq('operator_id', operatorId).maybeSingle();
  return data || null;
}

/* Envio imediato a partir do painel: o wa.me e so um link (sem chamada de rede), por isso
   resolve-se logo em vez de esperar pelo worker. Nunca chama a API do WhatsApp num pedido. */
async function resolverAgora(operatorId, id) {
  const { data, error } = await supabaseAdmin.rpc('messaging_claim_one', { p_id: id });
  if (error) throw error;
  const reclamada = Array.isArray(data) ? data[0] : data;
  if (reclamada && reclamada.operator_id === operatorId) return processarLinha(reclamada);
  return lerLinha(operatorId, id); // ja estava processada (ou nao e deste operador)
}

async function cancelarPorReserva(operatorId, bookingId) {
  const { data, error } = await supabaseAdmin
    .from('message_outbox')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('operator_id', operatorId).eq('booking_id', bookingId)
    .in('status', ['queued', 'awaiting_human'])
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

async function marcarAberto(operatorId, id) {
  const { data, error } = await supabaseAdmin
    .from('message_outbox')
    .update({ opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('operator_id', operatorId).is('opened_at', null)
    .select('id, opened_at').maybeSingle();
  if (error) throw error;
  return data;
}

async function listar(operatorId, { status, bookingId, bookingIds, limit = 50 } = {}) {
  let q = supabaseAdmin
    .from('message_outbox')
    .select('id, booking_id, trigger, to_e164, locale, status, handoff_url, opened_at, last_error, created_at, payload')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));
  if (status) q = q.in('status', String(status).split(','));
  if (bookingId) q = q.eq('booking_id', bookingId);
  if (bookingIds) q = q.in('booking_id', bookingIds.length ? bookingIds : ['00000000-0000-0000-0000-000000000000']);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(({ payload, ...r }) => ({ ...r, display: payload?.display || {} }));
}

module.exports = {
  MAX_TENTATIVAS, backoffMs, erro, planoParaResultado,
  obterConfig, enfileirar, processarLinha, resolverAgora, cancelarPorReserva, marcarAberto, listar,
};
