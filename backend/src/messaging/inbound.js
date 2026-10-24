/* Eventos recebidos (webhooks): gravados em bruto antes de processar (message_inbound), depois
   processados fora do request, pelo worker. Idempotente: a unique (provider, provider_event_id)
   ignora o segundo insert, porque o OpenWA e a Meta reenviam o mesmo evento.

   OpenWA: payload = envelope do OpenWA.   Cloud API: payload = { evento } ja normalizado (+ o item em bruto). */

const { supabaseAdmin } = require('../config/supabase');
const openwa = require('./providers/openwa');
const cloudApi = require('./providers/cloudApi');
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Grava o evento em bruto. Devolve true se era novo, false se ja existia. */
async function guardarEvento({ provider, eventId, operatorId, payload, contact = null }) {
  const { data, error } = await supabaseAdmin
    .from('message_inbound')
    .upsert(
      { provider, provider_event_id: String(eventId), operator_id: operatorId || null, payload, contact_e164: contact },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

/* Aplica um estado de entrega a linha da outbox: por id do fornecedor ou, na Cloud API, pelo id da outbox
   devolvido em biz_opaque_callback_data. */
async function aplicarEstado(evento, provider) {
  const ids = [evento.providerMessageId, ...(evento.alternativeIds || [])];
  let { data: linhas } = await supabaseAdmin
    .from('message_outbox').select('id, status')
    .eq('provider', provider).in('provider_message_id', ids).limit(1);
  let porOutbox = false;
  if (!linhas?.length && evento.outboxId && UUID.test(evento.outboxId)) {
    ({ data: linhas } = await supabaseAdmin
      .from('message_outbox').select('id, status')
      .eq('provider', provider).eq('id', evento.outboxId).limit(1));
    porOutbox = true;
  }
  const linha = linhas?.[0];
  if (!linha) return false;
  const novo = proximoEstado(linha.status, evento.status);
  if (!novo) return false;
  const campos = { status: novo, last_error: novo === 'failed' ? (evento.error || 'failed') : null, updated_at: new Date().toISOString() };
  // Reconciliacao: o estado chegou antes de o id do fornecedor ter sido gravado (ex.: o worker morreu a meio)
  if (porOutbox) campos.provider_message_id = evento.providerMessageId;
  const { error } = await supabaseAdmin.from('message_outbox').update(campos).eq('id', linha.id);
  if (error) throw error;
  return true;
}

/* Estado de um template da Meta (aprovado, rejeitado...) para o operador dono da WABA. */
async function aplicarTemplate(ev) {
  const novo = cloudApi.estadoDoTemplate(ev.event);
  if (!novo || !ev.wabaId) return false;
  const { data: cfg } = await supabaseAdmin.from('messaging_config').select('operator_id').eq('cloud_waba_id', ev.wabaId).maybeSingle();
  if (!cfg) return false;
  let q = supabaseAdmin.from('message_meta_templates')
    .update({ meta_status: novo, meta_template_id: ev.templateId, meta_reason: ev.reason, updated_at: new Date().toISOString() })
    .eq('operator_id', cfg.operator_id).eq('meta_name', ev.name);
  if (ev.language) q = q.eq('meta_language', ev.language);
  const { data, error } = await q.select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

/* Eventos normalizados de uma linha de message_inbound (conforme o fornecedor). */
function eventosDaLinha(row) {
  if (row.provider === 'cloud_api') return row.payload?.evento ? [row.payload.evento] : [];
  return openwa.parseWebhook(row.payload, { operatorId: row.operator_id });
}

/* Processa os eventos por tratar. As mensagens recebidas de clientes ficam so guardadas (a conversa por
   reserva e da fase 4; o contacto gravado ja serve para a janela de 24 h); estados, templates e eventos de
   sessao tem efeito ja. */
async function processarPendentes({ limite = 50, alertar } = {}) {
  const { data, error } = await supabaseAdmin
    .from('message_inbound')
    .select('id, provider, operator_id, payload')
    .in('provider', ['openwa', 'cloud_api']).is('processed_at', null)
    .order('id').limit(limite);
  if (error) throw error;

  const registo = obterRegisto();
  const alerta = alertar || registo.openwa?.alertar || registo.cloud_api?.alertar;
  let estados = 0;
  for (const row of data || []) {
    try {
      for (const ev of eventosDaLinha(row)) {
        if (ev.type === 'status' && await aplicarEstado(ev, row.provider)) estados++;
        if (ev.type === 'template') await aplicarTemplate(ev);
        if (row.provider === 'cloud_api' && !row.operator_id && alerta) {
          await alerta(`Evento da Meta para um numero/conta desconhecidos (phone_number_id ${ev.phoneNumberId || '-'}, waba ${ev.wabaId || '-'}): nenhum operador o tem configurado.`);
        }
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

module.exports = { proximoEstado, ipInterno, guardarEvento, processarPendentes, eventosDaLinha };
