const { supabaseAdmin } = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/encrypt');
const { verifyViatorSignature, verifyGygSignature } = require('../utils/webhookVerify');
const { addWebhookJob, addSyncJob } = require('../queues/queueManager');

/* ─── Auxiliares ─────────────────────────────────────────── */

async function registarLog(operatorId, channel, eventType, payload, status, errorMsg, externalRef) {
  await supabaseAdmin.from('integration_logs').insert({
    operator_id:   operatorId,
    channel,
    event_type:    eventType,
    payload:       payload || null,
    status,
    error_message: errorMsg || null,
    external_ref:  externalRef || null,
  });
}

async function verificarIdempotencia(externalRef, channel) {
  if (!externalRef) return false;
  const { data } = await supabaseAdmin
    .from('integration_logs')
    .select('id')
    .eq('external_ref', externalRef)
    .eq('channel', channel)
    .eq('status', 'processed')
    .maybeSingle();
  return !!data;
}

/* ─── Connect / Disconnect ───────────────────────────────── */

async function connectChannel(req, res, next) {
  try {
    const { channel } = req.params;
    const { api_key, supplier_id, product_ids } = req.body;

    if (!['viator', 'getyourguide'].includes(channel)) {
      return res.status(400).json({ error: 'Canal invalido', code: 'INVALID_CHANNEL' });
    }
    if (!api_key) {
      return res.status(400).json({ error: 'api_key e obrigatorio', code: 'MISSING_FIELDS' });
    }

    const { data, error } = await supabaseAdmin
      .from('operator_channels')
      .upsert({
        operator_id: req.operator.id,
        channel,
        api_key_enc: encrypt(api_key),
        supplier_id: supplier_id || null,
        product_ids: product_ids || null,
        is_active:   true,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'operator_id,channel' })
      .select('id, channel, supplier_id, product_ids, is_active, last_sync_at, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ data, message: `Canal ${channel} configurado com sucesso` });
  } catch (err) {
    next(err);
  }
}

async function disconnectChannel(req, res, next) {
  try {
    const { channel } = req.params;
    const { error } = await supabaseAdmin
      .from('operator_channels')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('operator_id', req.operator.id)
      .eq('channel', channel);

    if (error) throw error;
    return res.json({ data: null, message: `Canal ${channel} desactivado` });
  } catch (err) {
    next(err);
  }
}

/* ─── Status ─────────────────────────────────────────────── */

async function getStatus(req, res, next) {
  try {
    const [channelsRes, logsRes] = await Promise.all([
      supabaseAdmin
        .from('operator_channels')
        .select('id, channel, supplier_id, product_ids, is_active, last_sync_at, sync_error, created_at')
        .eq('operator_id', req.operator.id),
      supabaseAdmin
        .from('integration_logs')
        .select('channel, status')
        .eq('operator_id', req.operator.id),
    ]);

    const channels = (channelsRes.data || []).map((c) => {
      const logs = (logsRes.data || []).filter((l) => l.channel === c.channel);
      return {
        ...c,
        total_events:    logs.length,
        failed_events:   logs.filter((l) => l.status === 'failed').length,
        processed_events: logs.filter((l) => l.status === 'processed').length,
      };
    });

    const configured = ['viator', 'getyourguide'].map((ch) => {
      const existing = channels.find((c) => c.channel === ch);
      return existing || { channel: ch, is_active: false, configured: false };
    });

    return res.json({ data: configured, message: 'Estado das integracoes' });
  } catch (err) {
    next(err);
  }
}

/* ─── Sync manual ────────────────────────────────────────── */

async function syncManual(req, res, next) {
  try {
    const { channel } = req.body;

    const { data: channels } = await supabaseAdmin
      .from('operator_channels')
      .select('*')
      .eq('operator_id', req.operator.id)
      .eq('is_active', true)
      .modify((q) => channel ? q.eq('channel', channel) : q);

    if (!channels?.length) {
      return res.status(404).json({ error: 'Nenhum canal activo encontrado', code: 'NOT_FOUND' });
    }

    for (const ch of channels) {
      await addSyncJob({ channelId: ch.id, operatorId: req.operator.id, channel: ch.channel });
    }

    return res.json({ data: null, message: `Sincronizacao iniciada para ${channels.length} canal(is)` });
  } catch (err) {
    next(err);
  }
}

/* ─── Logs ───────────────────────────────────────────────── */

async function getLogs(req, res, next) {
  try {
    const { channel, status, limit = 50, offset = 0 } = req.query;

    let q = supabaseAdmin
      .from('integration_logs')
      .select('*', { count: 'exact' })
      .eq('operator_id', req.operator.id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (channel) q = q.eq('channel', channel);
    if (status)  q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) throw error;

    return res.json({ data, total: count, message: 'Logs listados' });
  } catch (err) {
    next(err);
  }
}

/* ─── Webhooks ───────────────────────────────────────────── */

async function viatorWebhook(req, res, next) {
  res.status(200).json({ received: true });

  try {
    if (!verifyViatorSignature(req)) {
      console.warn('[Viator] Webhook com assinatura invalida');
      return;
    }

    const payload    = req.body;
    const externalRef = payload?.booking?.bookingRef || payload?.bookingRef || null;

    if (await verificarIdempotencia(externalRef, 'viator')) {
      console.log(`[Viator] Webhook duplicado ignorado: ${externalRef}`);
      return;
    }

    const { data: channel } = await supabaseAdmin
      .from('operator_channels')
      .select('operator_id')
      .eq('channel', 'viator')
      .eq('is_active', true)
      .maybeSingle();

    if (!channel) return;

    await registarLog(channel.operator_id, 'viator', payload.event || 'booking_event', payload, 'received', null, externalRef);
    await addWebhookJob({ channel: 'viator', operatorId: channel.operator_id, payload, externalRef });
  } catch (err) {
    console.error('[Viator] Erro no webhook handler:', err.message);
  }
}

async function gygWebhook(req, res, next) {
  res.status(200).json({ received: true });

  try {
    if (!verifyGygSignature(req)) {
      console.warn('[GYG] Webhook com assinatura invalida');
      return;
    }

    const payload     = req.body;
    const externalRef = payload?.booking?.id || payload?.bookingId || null;

    if (await verificarIdempotencia(externalRef, 'getyourguide')) {
      console.log(`[GYG] Webhook duplicado ignorado: ${externalRef}`);
      return;
    }

    const { data: channel } = await supabaseAdmin
      .from('operator_channels')
      .select('operator_id')
      .eq('channel', 'getyourguide')
      .eq('is_active', true)
      .maybeSingle();

    if (!channel) return;

    await registarLog(channel.operator_id, 'getyourguide', payload.event || 'booking_event', payload, 'received', null, externalRef);
    await addWebhookJob({ channel: 'getyourguide', operatorId: channel.operator_id, payload, externalRef });
  } catch (err) {
    console.error('[GYG] Erro no webhook handler:', err.message);
  }
}

module.exports = { connectChannel, disconnectChannel, getStatus, syncManual, getLogs, viatorWebhook, gygWebhook };
