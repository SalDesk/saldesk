/* Eventos recebidos (webhooks): gravados em bruto antes de processar (message_inbound), depois
   processados fora do request, pelo worker. Idempotente: a unique (provider, provider_event_id)
   ignora o segundo insert, porque o OpenWA (como a Meta) pode reenviar o mesmo evento. */

const { supabaseAdmin } = require('../config/supabase');
const openwa = require('./providers/openwa');
const { obterRegisto } = require('./router');

/* Estados que so avancam: sent -> delivered -> read. A ordem de chegada dos webhooks nao e
   garantida, por isso um 'delivered' depois de 'read' e ignorado. 'failed' so apanha mensagens
   que ainda nao foram entregues. Devolve o novo estado, ou null se nao ha nada a fazer. */
const ORDEM = { queued: 0, sending: 0, sent: 1, delivered: 2, read: 3 };

function proximoEstado(atual, novo) {
  if (novo === 'failed') return ORDEM[atual] !== undefined && ORDEM[atual] <= ORDEM.sent ? 'failed' : null;
  if (ORDEM[novo] === undefined || ORDEM[atual] === undefined) return null;
  return ORDEM[novo] > ORDEM[atual] ? novo : null;
}

/* So aceita pedidos vindos da propria maquina ou da rede privada do Docker (o OpenWA corre num
   contentor e chama o servidor pela ponte). 127.0.0.0/8, ::1 e 172.16.0.0/12. */
function ipInterno(ip) {
  if (!ip) return false;
  const limpo = String(ip).replace(/^::ffff:/, '');
  if (limpo === '::1' || /^127\./.test(limpo)) return true;
  const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(limpo);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

/* Grava o evento em bruto. Devolve true se era novo, false se ja existia. */
async function guardarEvento({ provider, eventId, operatorId, payload }) {
  const { data, error } = await supabaseAdmin
    .from('message_inbound')
    .upsert({ provider, provider_event_id: String(eventId), operator_id: operatorId || null, payload }, { onConflict: 'provider,provider_event_id', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

async function aplicarEstado(evento) {
  const ids = [evento.providerMessageId, ...(evento.alternativeIds || [])];
  const { data: linhas } = await supabaseAdmin
    .from('message_outbox')
    .select('id, status')
    .eq('provider', 'openwa').in('provider_message_id', ids)
    .limit(1);
  const linha = linhas?.[0];
  if (!linha) return false;
  const novo = proximoEstado(linha.status, evento.status);
  if (!novo) return false;
  const { error } = await supabaseAdmin
    .from('message_outbox')
    .update({ status: novo, last_error: novo === 'failed' ? (evento.error || 'failed') : null, updated_at: new Date().toISOString() })
    .eq('id', linha.id);
  if (error) throw error;
  return true;
}

/* Processa os eventos do OpenWA ainda por tratar. As mensagens recebidas de turistas ficam so
   guardadas (a conversa por reserva e da fase 4); estados e eventos de sessao tem efeito ja. */
async function processarPendentes({ limite = 50, alertar } = {}) {
  const { data, error } = await supabaseAdmin
    .from('message_inbound')
    .select('id, operator_id, payload')
    .eq('provider', 'openwa').is('processed_at', null)
    .order('id').limit(limite);
  if (error) throw error;

  const alerta = alertar || obterRegisto().openwa?.alertar;
  let estados = 0;
  for (const row of data || []) {
    try {
      for (const ev of openwa.parseWebhook(row.payload, { operatorId: row.operator_id })) {
        if (ev.type === 'status' && await aplicarEstado(ev)) estados++;
        if (ev.type === 'session' && ev.event !== 'session.status' && alerta) {
          await alerta(`Sessao do OpenWA: ${ev.event}${ev.status ? ` (${ev.status})` : ''}`);
        }
        if (ev.type === 'session' && ev.event === 'session.status' && ev.status && !['ready', 'authenticating', 'initializing', 'qr_ready', 'created'].includes(ev.status) && alerta) {
          await alerta(`Sessao do OpenWA em estado "${ev.status}"`);
        }
      }
      await supabaseAdmin.from('message_inbound').update({ processed_at: new Date().toISOString() }).eq('id', row.id);
    } catch (err) {
      console.error(`[Messaging] Erro a processar o evento recebido ${row.id}:`, err.message);
    }
  }
  return { lidos: (data || []).length, estados };
}

module.exports = { proximoEstado, ipInterno, guardarEvento, processarPendentes };
