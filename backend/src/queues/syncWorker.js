const { supabaseAdmin } = require('../config/supabase');
const { decrypt } = require('../utils/encrypt');
const axios = require('axios');

async function processSyncJob({ data }) {
  const { channelId, operatorId, channel } = data;

  const { data: ch } = await supabaseAdmin
    .from('operator_channels')
    .select('*')
    .eq('id', channelId)
    .single();

  if (!ch || !ch.is_active) return;

  const apiKey = decrypt(ch.api_key_enc);
  const hoje   = new Date().toISOString().split('T')[0];
  const fim    = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  /* Obter reservas e datas bloqueadas do periodo */
  const [reservasRes, bloqueiosRes, unidadesRes] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select('unit_id, check_in, check_out, status')
      .eq('operator_id', operatorId)
      .neq('status', 'cancelled')
      .lte('check_in', fim)
      .gt('check_out', hoje),
    supabaseAdmin
      .from('blocked_dates')
      .select('unit_id, date')
      .gte('date', hoje)
      .lte('date', fim),
    supabaseAdmin
      .from('units')
      .select('id, name')
      .eq('operator_id', operatorId)
      .eq('status', 'active'),
  ]);

  const daysUnavailable = {};
  for (const r of reservasRes.data || []) {
    const cur = new Date(r.check_in + 'T00:00:00Z');
    const end = new Date(r.check_out + 'T00:00:00Z');
    while (cur < end) {
      const ds = cur.toISOString().split('T')[0];
      if (!daysUnavailable[r.unit_id]) daysUnavailable[r.unit_id] = new Set();
      daysUnavailable[r.unit_id].add(ds);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  for (const b of bloqueiosRes.data || []) {
    if (!daysUnavailable[b.unit_id]) daysUnavailable[b.unit_id] = new Set();
    daysUnavailable[b.unit_id].add(b.date);
  }

  let syncError = null;

  try {
    if (channel === 'viator') {
      await sincronizarViator(apiKey, ch.supplier_id, unidadesRes.data || [], daysUnavailable, ch.product_ids);
    } else if (channel === 'getyourguide') {
      await sincronizarGyg(apiKey, unidadesRes.data || [], daysUnavailable, ch.product_ids);
    }
  } catch (err) {
    syncError = err.message;
    await supabaseAdmin.from('integration_logs').insert({
      operator_id: operatorId, channel,
      event_type: 'sync_failed', payload: { error: err.message },
      status: 'failed', error_message: err.message,
    });
  }

  await supabaseAdmin
    .from('operator_channels')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_error:   syncError || null,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', channelId);

  if (!syncError) {
    await supabaseAdmin.from('integration_logs').insert({
      operator_id: operatorId, channel,
      event_type: 'sync_success', payload: { units: (unidadesRes.data || []).length },
      status: 'processed',
    });
  }
}

async function sincronizarViator(apiKey, supplierId, units, daysUnavailable, productIds) {
  if (!process.env.VIATOR_API_BASE_URL || !supplierId) return;
  /* Viator Connectivity API — actualizar disponibilidade */
  const baseUrl = process.env.VIATOR_API_BASE_URL;
  for (const unit of units) {
    const blocked = [...(daysUnavailable[unit.id] || [])];
    if (!blocked.length) continue;
    await axios.post(
      `${baseUrl}/availability/schedules/update`,
      { supplierId, blocked },
      { headers: { 'exp-api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
  }
}

async function sincronizarGyg(apiKey, units, daysUnavailable, productIds) {
  if (!process.env.GYG_API_BASE_URL) return;
  const baseUrl = process.env.GYG_API_BASE_URL;
  for (const unit of units) {
    const blocked = [...(daysUnavailable[unit.id] || [])];
    if (!blocked.length) continue;
    await axios.put(
      `${baseUrl}/availability`,
      { blocked_dates: blocked },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
  }
}

module.exports = { processSyncJob };
