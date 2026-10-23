/* Worker da outbox. Corre num processo PM2 proprio (messagingWorker.js), nunca no servidor web.

   Cada ciclo: devolve a fila as linhas presas, reclama um lote vencido (SKIP LOCKED),
   processa cada uma (router -> adapter -> resultado) e avisa se houver mensagens vencidas
   ha demasiado tempo (worker parado ou preso). */

const { supabaseAdmin } = require('../config/supabase');
const { processarLinha } = require('./outbox');

const LOTE = 20;
const ATRASO_ALERTA_MIN = 10;

async function tick({ limite = LOTE } = {}) {
  const { data: reaped, error: erroReap } = await supabaseAdmin.rpc('messaging_reap', { p_older_than: '5 minutes' });
  if (erroReap) console.error('[Messaging] Falha no reaper:', erroReap.message);

  const { data, error } = await supabaseAdmin.rpc('messaging_claim', { p_limit: limite });
  if (error) throw error;

  const linhas = data || [];
  let ok = 0;
  let falhas = 0;
  for (const row of linhas) {
    try {
      await processarLinha(row);
      ok++;
    } catch (err) {
      // A linha fica em 'sending'; o reaper devolve-a a fila ao fim de 5 minutos.
      falhas++;
      console.error(`[Messaging] Erro a processar ${row.id}:`, err.message);
    }
  }
  return { reclamadas: linhas.length, ok, falhas, reaped: reaped || 0 };
}

/* Mensagens que deviam ja ter saido ha mais de ATRASO_ALERTA_MIN minutos. */
async function verificarAtraso() {
  const limite = new Date(Date.now() - ATRASO_ALERTA_MIN * 60_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('message_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued').lt('next_attempt_at', limite);
  if (error) return 0;
  if (count > 0) {
    console.warn(`[Messaging] ALERTA: ${count} mensagem(ns) vencida(s) ha mais de ${ATRASO_ALERTA_MIN} minutos na outbox`);
  }
  return count || 0;
}

module.exports = { tick, verificarAtraso, LOTE, ATRASO_ALERTA_MIN };
