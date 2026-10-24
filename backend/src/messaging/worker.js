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
// Taxa por operador: um operador com muitas reservas nao degrada a qualidade do numero nem atrasa os restantes.
const MAX_POR_OPERADOR_POR_CICLO = Number(process.env.MESSAGING_MAX_POR_OPERADOR_CICLO) || 5; // ~20/min com ciclos de 15 s
const ADIAR_EXCESSO_MS = 30_000;
// O wa.me nao envia nada (so devolve um link): sem limite.
const SEM_LIMITE = new Set(['wame']);

/* Separa o que se processa agora do que excede o limite do operador neste ciclo. Pura. */
function repartirPorOperador(linhas, maximo = MAX_POR_OPERADOR_POR_CICLO) {
  const contagem = new Map();
  const processar = [];
  const adiar = [];
  for (const row of linhas) {
    if (SEM_LIMITE.has(row.provider)) { processar.push(row); continue; }
    const n = contagem.get(row.operator_id) || 0;
    if (n < maximo) { contagem.set(row.operator_id, n + 1); processar.push(row); } else adiar.push(row);
  }
  return { processar, adiar };
}

/* O que fazer com o estado de um numero da Meta. 'suspender' pára os envios automaticos (passam ao wa.me)
   antes que a Meta restrinja o numero; 'avisar' so alerta. */
function decidirQualidade({ quality_rating: qualidade, status } = {}) {
  const q = String(qualidade || '').toUpperCase();
  const s = String(status || '').toUpperCase();
  if (q === 'RED' || ['FLAGGED', 'RESTRICTED', 'BANNED', 'DISCONNECTED', 'DELETED', 'UNVERIFIED'].includes(s)) return 'suspender';
  if (q === 'YELLOW' || ['PENDING'].includes(s)) return 'avisar';
  return 'ok';
}

async function tick({ limite = LOTE } = {}) {
  const { data: reaped, error: erroReap } = await supabaseAdmin.rpc('messaging_reap', { p_older_than: '5 minutes' });
  if (erroReap) console.error('[Messaging] Falha no reaper:', erroReap.message);

  const { data, error } = await supabaseAdmin.rpc('messaging_claim', { p_limit: limite });
  if (error) throw error;

  const { processar, adiar } = repartirPorOperador(data || []);
  // O excesso volta a fila sem gastar uma tentativa (attempts foi incrementado ao reclamar).
  for (const row of adiar) {
    await supabaseAdmin.from('message_outbox').update({
      status: 'queued', attempts: Math.max(0, row.attempts - 1),
      next_attempt_at: new Date(Date.now() + ADIAR_EXCESSO_MS).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', row.id);
  }
  const linhas = processar;
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

/* Qualidade e estado do numero de cada operador com a Cloud API activa. Se a Meta o marcar (RED, FLAGGED, restrito...),
   o canal e suspendido (as mensagens passam ao wa.me) e o fundador e avisado; reactivar e decisao humana. */
async function verificarQualidade() {
  const provider = obterRegisto().cloud_api;
  if (!provider) return [];
  const { data: configs } = await supabaseAdmin
    .from('messaging_config')
    .select('operator_id, cloud_phone_id, cloud_status, quality_rating')
    .eq('provider', 'cloud_api').eq('cloud_status', 'active');
  const { obterCredenciais, esquecerCredenciais } = require('./cloudContext');
  const resultado = [];
  for (const c of configs || []) {
    const cred = await obterCredenciais(c.operator_id);
    if (!cred) { await provider.alertar(`Cloud API do operador ${c.operator_id}: sem credenciais para verificar o numero.`); continue; }
    const est = await provider.estadoNumero(cred);
    if (!est.ok) {
      await provider.alertar(`Cloud API do operador ${c.operator_id}: nao foi possivel verificar o numero (HTTP ${est.httpStatus}${est.codigo ? `, codigo ${est.codigo}` : ''}).`);
      continue;
    }
    const accao = decidirQualidade(est);
    const campos = { quality_rating: est.quality_rating || null, updated_at: new Date().toISOString() };
    if (accao === 'suspender') campos.cloud_status = 'suspended';
    await supabaseAdmin.from('messaging_config').update(campos).eq('operator_id', c.operator_id);
    if (accao === 'suspender') {
      esquecerCredenciais(c.operator_id);
      await provider.alertar(`Cloud API do operador ${c.operator_id} SUSPENSA: qualidade ${est.quality_rating}, estado ${est.status}. As mensagens passam ao wa.me ate se rever.`);
    } else if (accao === 'avisar') {
      await provider.alertar(`Cloud API do operador ${c.operator_id}: qualidade do numero ${est.quality_rating}, estado ${est.status}. Atencao ao volume e aos bloqueios.`);
    }
    resultado.push({ operator_id: c.operator_id, accao, quality: est.quality_rating, status: est.status });
  }
  return resultado;
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

module.exports = { tick, verificarAtraso, verificarSessao, verificarQualidade, repartirPorOperador, decidirQualidade, LOTE, ATRASO_ALERTA_MIN };
