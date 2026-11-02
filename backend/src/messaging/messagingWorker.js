/* Ponto de entrada do worker da outbox (processo PM2 proprio: saldesk-messaging-worker).
   Le o .env do backend pelo caminho do ficheiro, para nao depender do cwd do PM2. */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { tick, verificarAtraso, verificarSessao, verificarQualidade } = require('./worker');
const { processarReenvios, verificarSaudeEmail, alertarFundador } = require('../services/emailRetryService');

const INTERVALO_MS = Number(process.env.MESSAGING_WORKER_INTERVAL_MS) || 15_000;
const VERIFICAR_ATRASO_CADA = 20; // ciclos (~5 minutos)
const VERIFICAR_QUALIDADE_CADA = 240; // ciclos (~1 hora)
const REENVIAR_EMAILS_CADA = 4; // ciclos (~1 minuto)
const estadoEmail = { alertando: false, ultimoAlerta: null }; // para o alerta nao se repetir a cada ciclo

let parar = false;
let ciclo = 0;

async function correr() {
  console.log(`[Messaging] Worker iniciado (intervalo ${INTERVALO_MS} ms)`);
  while (!parar) {
    try {
      const r = await tick();
      if (r.reclamadas || r.reaped) {
        console.log(`[Messaging] ciclo: ${r.reclamadas} reclamada(s), ${r.ok} ok, ${r.falhas} com erro, ${r.reaped} devolvida(s) a fila`);
      }
      if (++ciclo % VERIFICAR_ATRASO_CADA === 0) {
        await verificarAtraso();
        await verificarSessao();
      }
      if (ciclo % VERIFICAR_QUALIDADE_CADA === 0) await verificarQualidade();
      // Emails que falharam: reenvio automatico e vigilancia (o worker e um processo a parte do servidor web)
      if (ciclo % REENVIAR_EMAILS_CADA === 0) {
        const e = await processarReenvios();
        if (e.enviados || e.adiados || e.abandonados || e.permanentes || e.expirados) {
          console.log(`[Email] reenvio: ${e.enviados} enviado(s), ${e.adiados} adiado(s), ${e.abandonados} esgotado(s), ${e.permanentes} permanente(s), ${e.expirados} expirado(s)`);
        }
        await verificarSaudeEmail({ alertar: alertarFundador, estado: estadoEmail });
      }
    } catch (err) {
      // Um ciclo falhado nunca derruba o worker: regista e tenta no seguinte.
      console.error('[Messaging] Erro no ciclo do worker:', err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  }
  console.log('[Messaging] Worker parado');
  process.exit(0);
}

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => { parar = true; });
}

correr();
