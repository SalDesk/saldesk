/* Webhook da WhatsApp Cloud API: /webhooks/whatsapp/cloud (publico: e a Meta que chama).

   GET  - handshake de verificacao (hub.mode, hub.verify_token, hub.challenge).
   POST - estados de entrega, mensagens recebidas e estado dos templates. Verifica a assinatura
          X-Hub-Signature-256 sobre o corpo em bruto, grava cada evento (idempotente) e responde 200
          depressa: a Meta reenvia se demorar. O processamento corre depois, no worker.

   O operador de cada evento e o dono do phone_number_id (ou da WABA, nos eventos de templates). Um evento de um
   numero desconhecido e gravado sem operador e gera alerta no worker; nunca e descartado. Desligado
   (CLOUD_API_ENABLED != true ou sem META_APP_SECRET), a rota nao existe (404). */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const cloudApi = require('../messaging/providers/cloudApi');
const { guardarEvento } = require('../messaging/inbound');

function activo(env = process.env) {
  return env.CLOUD_API_ENABLED === 'true' && !!env.META_APP_SECRET;
}

function iguais(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || '')).digest();
  const hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* Identificador estavel do evento, para a dedupe (a Meta reenvia). */
function idDoEvento(ev) {
  if (ev.type === 'status') return `${ev.providerMessageId}:${ev.status}`;
  if (ev.type === 'message') return `in:${ev.providerMessageId}`;
  return `tpl:${ev.templateId || ev.name}:${ev.event}:${ev.language || ''}`;
}

async function operadorDoEvento(ev) {
  if (ev.phoneNumberId) {
    const { data } = await supabaseAdmin.from('messaging_config').select('operator_id').eq('cloud_phone_id', ev.phoneNumberId).maybeSingle();
    if (data) return data.operator_id;
  }
  if (ev.wabaId) {
    const { data } = await supabaseAdmin.from('messaging_config').select('operator_id').eq('cloud_waba_id', ev.wabaId).maybeSingle();
    if (data) return data.operator_id;
  }
  return null;
}

/* GET /webhooks/whatsapp/cloud */
function verificar(req, res) {
  if (!activo()) return res.sendStatus(404);
  const { 'hub.mode': modo, 'hub.verify_token': token, 'hub.challenge': desafio } = req.query;
  if (modo === 'subscribe' && process.env.META_WEBHOOK_VERIFY_TOKEN && token && iguais(token, process.env.META_WEBHOOK_VERIFY_TOKEN)) {
    return res.status(200).type('text/plain').send(String(desafio ?? ''));
  }
  console.error('[Messaging] Verificacao do webhook da Meta recusada (token errado)');
  return res.sendStatus(403);
}

/* POST /webhooks/whatsapp/cloud */
async function receber(req, res, next) {
  try {
    if (!activo()) return res.sendStatus(404);
    if (!cloudApi.verificarAssinaturaMeta(req.rawBody, req.headers, process.env.META_APP_SECRET)) {
      console.error(`[Messaging] Webhook da Meta recusado: assinatura invalida (ip=${req.ip})`);
      return res.sendStatus(401);
    }
    const eventos = cloudApi.parseWebhook(req.body);
    for (const ev of eventos) {
      const operatorId = await operadorDoEvento(ev);
      await guardarEvento({
        provider: 'cloud_api',
        eventId: idDoEvento(ev),
        operatorId,
        payload: { evento: ev },
        contact: ev.type === 'message' ? ev.from : null,
      });
    }
    return res.sendStatus(200);
  } catch (err) { next(err); }
}

module.exports = { verificar, receber, activo, idDoEvento };
