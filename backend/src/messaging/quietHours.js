/* Horas silenciosas: lembretes e pedidos de avaliacao nao saem entre as 22h e as 8h
   na hora de Cabo Verde (UTC-1, sem horario de verao). O next_attempt_at e ajustado
   na criacao da mensagem. Confirmacoes e accoes manuais do operador nao esperam. */

const OFFSET_CABO_VERDE_H = -1;
const INICIO_SILENCIO_H = 22;
const FIM_SILENCIO_H = 8;

// 'automation' = mensagens das automacoes do operador: entram na fila e esperam pelo dia.
const GATILHOS_COM_SILENCIO = new Set(['reminder_d1', 'review_request', 'automation']);

function horaLocal(date) {
  return (date.getUTCHours() + OFFSET_CABO_VERDE_H + 24) % 24;
}

function emHorasSilenciosas(date) {
  const h = horaLocal(date);
  return h >= INICIO_SILENCIO_H || h < FIM_SILENCIO_H;
}

/* Proximo instante em que se pode enviar: o proprio se estiver fora das horas silenciosas,
   senao as 08:00 locais (09:00 UTC) seguintes. */
function proximoEnvioPermitido(date = new Date()) {
  if (!emHorasSilenciosas(date)) return new Date(date);
  // Trabalha em hora local: desloca o instante para que os campos UTC passem a ser os locais.
  // (Perto da meia-noite UTC a data local e a UTC podem ser dias diferentes.)
  const local = new Date(date.getTime() + OFFSET_CABO_VERDE_H * 3_600_000);
  // Entre as 22h e a meia-noite locais, o proximo 08:00 e no dia seguinte.
  if (local.getUTCHours() >= INICIO_SILENCIO_H) local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(FIM_SILENCIO_H, 0, 0, 0);
  return new Date(local.getTime() - OFFSET_CABO_VERDE_H * 3_600_000);
}

/* Aplica as horas silenciosas so aos gatilhos que as respeitam. */
function quandoEnviar(gatilho, date = new Date()) {
  return GATILHOS_COM_SILENCIO.has(gatilho) ? proximoEnvioPermitido(date) : new Date(date);
}

module.exports = { emHorasSilenciosas, proximoEnvioPermitido, quandoEnviar, GATILHOS_COM_SILENCIO };
