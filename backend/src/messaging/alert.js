/* Alertas operacionais da camada de mensagens (ex.: sessao do OpenWA perdida).

   Nunca falha em silencio: regista sempre no log e envia um email ao fundador, no maximo
   um por intervalo (por omissao 1 hora), para uma sessao em baixo nao encher a caixa de entrada. */

const INTERVALO_MS = 60 * 60 * 1000;

function criarAlertador({ enviar, para, intervaloMs = INTERVALO_MS, agora = () => Date.now(), registar = console.error } = {}) {
  let ultimo = -Infinity; // nunca alertou: o primeiro alerta sai sempre
  return async function alertar(motivo) {
    registar(`[Messaging] ALERTA: ${motivo}`);
    if (!enviar || !para) return false;
    const t = agora();
    if (t - ultimo < intervaloMs) return false;
    ultimo = t;
    try {
      await enviar({
        to: para,
        subject: 'SalDesk: alerta da camada de mensagens (OpenWA)',
        text: `${motivo}\n\nO OpenWA so e usado internamente pela Wandr. Enquanto a sessao estiver em baixo, as mensagens ficam em fila e tentam de novo sozinhas.\n\n(Este alerta repete-se no maximo uma vez por hora.)`,
      });
      return true;
    } catch (err) {
      registar('[Messaging] Falha a enviar o email de alerta:', err.message);
      return false;
    }
  };
}

module.exports = { criarAlertador, INTERVALO_MS };
