/* Worker da outbox. Corre num processo PM2 proprio (messagingWorker.js), nunca no servidor web.

   Cada ciclo: devolve a fila as linhas presas, reclama um lote vencido (SKIP LOCKED),
   processa cada uma (router -> adapter -> resultado) e avisa se houver mensagens vencidas
   ha demasiado tempo (worker parado ou preso). */

const { supabaseAdmin } = require('../config/supabase');
const { processarLinha } = require('./outbox');
const { processarPendentes } = require('./inbound');
const { obterRegisto } = require('./router');
const { accaoParaEstado } = require('./providers/openwa');

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
  // Estados de entrega e eventos de sessao recebidos por webhook (OpenWA)
  let eventos = { lidos: 0, estados: 0 };
  try {
    eventos = await processarPendentes();
  } catch (err) {
    console.error('[Messaging] Falha a processar eventos recebidos:', err.message);
  }
  return { reclamadas: linhas.length, ok, falhas, reaped: reaped || 0, eventos };
}

/* Sessao do OpenWA ligada? Se nao, alerta (no maximo um email por hora). Sem OpenWA configurado nao faz nada. */
async function verificarSessao() {
  const provider = obterRegisto().openwa;
  if (!provider) return null;
  const s = await provider.estadoSessao();
  const accao = accaoParaEstado(s.status);
  const detalhe = `estado: ${s.status || 'sem resposta'}${s.lastError ? `, ${s.lastError}` : ''}`;
  if (accao === 'reiniciar') {
    // Tipico depois de reiniciar o contentor ou o servidor: volta a ligar sozinha, sem QR.
    const r = await provider.iniciarSessao();
    await provider.alertar(`A sessao do OpenWA estava desligada (${detalhe}); a reiniciar sozinha (${r.ok ? 'pedido aceite' : `falhou, HTTP ${r.httpStatus}`}).`);
  } else if (accao === 'humano') {
    await provider.alertar(`A sessao do OpenWA precisa de atencao (${detalhe}). Pode ser preciso ligar outra vez o telemovel.`);
  }
  return { ...s, accao };
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

module.exports = { tick, verificarAtraso, verificarSessao, LOTE, ATRASO_ALERTA_MIN };
