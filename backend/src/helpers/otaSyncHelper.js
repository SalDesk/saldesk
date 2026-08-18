const { supabaseAdmin } = require('../config/supabase');

/* Dispara sincronizacao de disponibilidade para os canais OTA activos deste
   operador imediatamente (em vez de esperar pelo proximo ciclo do cron de
   15 em 15 min) -- chamado sempre que uma reserva/bloqueio muda a
   disponibilidade real de uma unidade. Fire-and-forget: nunca deve atrasar
   nem falhar a resposta do pedido que a chamou. */
async function dispararSyncImediato(operatorId) {
  try {
    const { data: canais } = await supabaseAdmin
      .from('operator_channels')
      .select('id, channel')
      .eq('operator_id', operatorId)
      .eq('is_active', true);
    if (!canais?.length) return;

    const { addSyncJob } = require('../queues/queueManager');
    for (const canal of canais) {
      await addSyncJob({ channelId: canal.id, operatorId, channel: canal.channel });
    }
  } catch (err) {
    console.error('[OTA Sync] Erro ao disparar sync imediato:', err.message);
  }
}

module.exports = { dispararSyncImediato };
