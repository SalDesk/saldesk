/* Reenvio automatico de emails e vigilancia da entrega. Corre no worker (processo PM2 proprio), nao no servidor web.

   - processarReenvios: volta a tentar os emails guardados em email_failures que ja venceram, com intervalos
     crescentes (helpers/emailQueue.js). Nao repete erros permanentes nem links que ja expiraram.
   - verificarSaudeEmail: avisa o fundador quando ha emails por entregar ha demasiado tempo, quando algum se esgotou
     sem sucesso, e quando tudo volta ao normal. Um email com falhas nunca fica so num registo que ninguem le.

   Os alertas nao dependem so do SendGrid: WhatsApp (OpenWA), o cartao do painel do fundador e email (que fica
   tambem em fila e sai quando o SendGrid voltar). Alertas do proprio sistema (kind 'alert') reenviam-se mas nunca
   geram outro alerta, para nao haver ciclos. */

const { supabaseAdmin } = require('../config/supabase');
const { classificarErro, proximaTentativa, expirado } = require('../helpers/emailQueue');

const PRESO_MIN = 10;      // 'sending' ha mais disto = o worker morreu a meio: volta a fila
const LIMIAR_ALERTA_MIN = 15; // so avisa se houver emails por entregar ha mais disto
const LEMBRETE_H = 6;      // enquanto a falha continuar, repete o aviso de 6 em 6 horas

/* ───────── acesso a base de dados (substituivel nos testes) ───────── */
function repoSupabase(db = supabaseAdmin) {
  return {
    async devolverPresos(agora) {
      await db.from('email_failures')
        .update({ status: 'pending', updated_at: agora.toISOString() })
        .eq('status', 'sending').lt('updated_at', new Date(agora.getTime() - PRESO_MIN * 60_000).toISOString());
    },
    async listarDevidos(limite, agora) {
      const { data, error } = await db.from('email_failures')
        .select('id, context, to_email, payload, kind, attempts, created_at')
        .eq('status', 'pending').lte('next_attempt_at', agora.toISOString())
        .order('next_attempt_at').limit(limite);
      if (error) throw error;
      return data || [];
    },
    /* Reserva a linha: so uma tentativa de cada vez, mesmo que haja dois workers. */
    async reivindicar(id, agora) {
      const { data } = await db.from('email_failures')
        .update({ status: 'sending', updated_at: agora.toISOString() })
        .eq('id', id).eq('status', 'pending').select('id');
      return (data || []).length > 0;
    },
    async guardar(id, campos, agora) {
      const { error } = await db.from('email_failures').update({ ...campos, updated_at: agora.toISOString() }).eq('id', id);
      if (error) throw error;
    },
    async estatisticas() {
      const { data: pend } = await db.from('email_failures')
        .select('context, to_email, created_at, last_error')
        .in('status', ['pending', 'sending']).eq('kind', 'transactional').order('created_at');
      const { data: esgotados } = await db.from('email_failures')
        .select('id, context, to_email, status, last_error')
        .in('status', ['abandoned', 'permanent']).eq('kind', 'transactional').is('alerted_at', null).order('created_at');
      return { pendentes: pend || [], esgotados: esgotados || [] };
    },
    async marcarAlertados(ids, agora) {
      if (!ids.length) return;
      await db.from('email_failures').update({ alerted_at: agora.toISOString() }).in('id', ids);
    },
  };
}

/* ───────── reenvio ───────── */
async function processarReenvios({ repo = repoSupabase(), enviar, agora = () => new Date(), limite = 10 } = {}) {
  const reenviar = enviar || require('../helpers/emailHelper').reenviarGuardado;
  const resumo = { enviados: 0, adiados: 0, abandonados: 0, permanentes: 0, expirados: 0 };
  await repo.devolverPresos(agora());

  for (const row of await repo.listarDevidos(limite, agora())) {
    const t = agora();
    if (!(await repo.reivindicar(row.id, t))) continue;

    if (expirado(row, t)) {
      await repo.guardar(row.id, { status: 'abandoned', last_error: 'expirou antes de ser entregue (o conteudo deixou de fazer sentido)' }, t);
      resumo.expirados++;
      continue;
    }

    const feitas = row.attempts + 1;
    try {
      await reenviar(row.payload);
      await repo.guardar(row.id, { status: 'sent', sent_at: t.toISOString(), attempts: feitas, last_error: null, next_attempt_at: null }, t);
      resumo.enviados++;
    } catch (err) {
      const classe = classificarErro(err);
      if (!classe.retryable) {
        await repo.guardar(row.id, { status: 'permanent', attempts: feitas, last_error: err.message, next_attempt_at: null }, t);
        resumo.permanentes++;
        continue;
      }
      const proxima = proximaTentativa(feitas, t);
      if (!proxima) {
        await repo.guardar(row.id, { status: 'abandoned', attempts: feitas, last_error: err.message, next_attempt_at: null }, t);
        resumo.abandonados++;
      } else {
        await repo.guardar(row.id, { status: 'pending', attempts: feitas, last_error: err.message, next_attempt_at: proxima.toISOString() }, t);
        resumo.adiados++;
      }
    }
  }
  return resumo;
}

/* ───────── vigilancia e alertas ───────── */
function resumirEmails(lista, max = 4) {
  const itens = lista.slice(0, max).map((e) => `"${String(e.context || 'sem assunto').slice(0, 50)}" para ${e.to_email || '?'}`);
  return itens.join('; ') + (lista.length > max ? `; e mais ${lista.length - max}` : '');
}

/* estado: { alertando, ultimoAlerta } guardado em memoria entre chamadas. Devolve as accoes tomadas (para os testes). */
async function verificarSaudeEmail({ repo = repoSupabase(), alertar, estado, agora = () => new Date() } = {}) {
  const accoes = [];
  const t = agora();
  const { pendentes, esgotados } = await repo.estatisticas();

  if (esgotados.length) {
    await alertar(`${esgotados.length} email(s) NAO foram entregues, mesmo depois de varias tentativas: ${resumirEmails(esgotados)}. Ultimo erro: ${esgotados[esgotados.length - 1].last_error || '-'}. Ver a tabela email_failures.`, 'esgotado');
    await repo.marcarAlertados(esgotados.map((e) => e.id), t);
    accoes.push('esgotado');
  }

  const maisAntigoMin = pendentes.length ? (t.getTime() - new Date(pendentes[0].created_at).getTime()) / 60_000 : 0;
  if (pendentes.length && maisAntigoMin >= LIMIAR_ALERTA_MIN) {
    const desdeUltimo = estado.ultimoAlerta ? (t.getTime() - estado.ultimoAlerta) / 3_600_000 : Infinity;
    if (!estado.alertando || desdeUltimo >= LEMBRETE_H) {
      await alertar(`${pendentes.length} email(s) por entregar (o mais antigo ha ${Math.round(maisAntigoMin)} min): ${resumirEmails(pendentes)}. Erro: ${pendentes[pendentes.length - 1].last_error || '-'}. O sistema continua a tentar sozinho.`, 'falha');
      estado.alertando = true;
      estado.ultimoAlerta = t.getTime();
      accoes.push('falha');
    }
  } else if (!pendentes.length && estado.alertando) {
    await alertar('O envio de emails voltou ao normal: nao ha emails por entregar.', 'recuperado');
    estado.alertando = false;
    estado.ultimoAlerta = null;
    accoes.push('recuperado');
  }
  return accoes;
}

/* ───────── canais do alerta ───────── */
/* WhatsApp (OpenWA, canal interno), email (kind 'alert') e log. Cada canal e opcional e falha sem derrubar os outros.
   A chave de dedupe por dia e tipo impede que um OpenWA em baixo acumule dezenas de avisos iguais. */
async function alertarFundador(texto, tipo = 'falha', { env = process.env, agora = () => new Date() } = {}) {
  console.error(`[Email] ALERTA (${tipo}): ${texto}`);
  const dia = agora().toISOString().slice(0, 10);

  const whatsapp = (async () => {
    const operatorId = env.WANDR_INTERNAL_OPERATOR_ID;
    if (!operatorId) return;
    const { data: op } = await supabaseAdmin.from('operators').select('whatsapp').eq('id', operatorId).maybeSingle();
    if (!op?.whatsapp) return;
    const { enfileirar } = require('../messaging/outbox');
    await enfileirar({
      operatorId, trigger: 'founder_alert', to: op.whatsapp, locale: 'pt', manual: true,
      text: `SalDesk: ${texto}`, display: { customerName: 'Alerta de emails' },
      dedupeKey: `founder-alert:email-${tipo}:${dia}`,
    });
  })();

  const email = (async () => {
    const para = env.ALERT_EMAIL || env.BCC_EMAIL;
    if (!para) return;
    const { enviarEmail } = require('../helpers/emailHelper');
    await enviarEmail({ to: para, subject: `SalDesk: alerta de emails (${tipo})`, text: texto, kind: 'alert' });
  })();

  const r = await Promise.allSettled([whatsapp, email]);
  r.forEach((x, i) => { if (x.status === 'rejected') console.error(`[Email] Canal de alerta ${i === 0 ? 'WhatsApp' : 'email'} falhou:`, x.reason?.message); });
}

module.exports = { processarReenvios, verificarSaudeEmail, alertarFundador, repoSupabase, resumirEmails, LIMIAR_ALERTA_MIN, LEMBRETE_H };
