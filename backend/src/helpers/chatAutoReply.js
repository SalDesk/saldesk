/* Chat do site: resposta automatica fora de horas.
   Logica pura (sem base de dados): validar a configuracao guardada em operators.chat_auto_reply,
   decidir se uma mensagem do hospede deve receber a resposta automatica e escolher o texto.

   Configuracao: { enabled, days: [0-6] (0 = domingo), from: 'HH:MM', to: 'HH:MM', message_pt, message_en }.
   O horario e na hora de Cabo Verde (UTC-1, sem horario de verao), calculada com Intl para nao depender do
   fuso do servidor. O intervalo [from, to) tem de ser no mesmo dia (nao atravessa a meia-noite). */

const FUSO = 'Atlantic/Cape_Verde';
const JANELA_SILENCIO_HORAS = 12;
const MAX_TEXTO = 500;

const TEXTO_PT = 'Obrigado pela sua mensagem. De momento estamos fora do horario de atendimento; responderemos assim que possivel.';
const TEXTO_EN = 'Thank you for your message. We are currently outside our opening hours and will reply as soon as we can.';

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DIAS_INGLES = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function ehObjecto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function minutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/* Valida e normaliza o que o operador envia. null/undefined = desligar (config nula). */
function validarConfig(raw) {
  if (raw === null || raw === undefined) return { ok: true, config: null };
  if (!ehObjecto(raw)) return { ok: false, error: 'Configuracao invalida' };
  if (typeof raw.enabled !== 'boolean') return { ok: false, error: 'enabled tem de ser verdadeiro ou falso' };

  const dias = raw.days === undefined ? [1, 2, 3, 4, 5] : raw.days;
  if (!Array.isArray(dias) || !dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return { ok: false, error: 'days tem de ser uma lista de dias 0-6 (0 = domingo)' };
  }
  const from = raw.from === undefined ? '09:00' : raw.from;
  const to = raw.to === undefined ? '18:00' : raw.to;
  if (typeof from !== 'string' || !HORA_RE.test(from) || typeof to !== 'string' || !HORA_RE.test(to)) {
    return { ok: false, error: 'from e to tem de estar no formato HH:MM' };
  }
  if (minutos(to) <= minutos(from)) return { ok: false, error: 'to tem de ser posterior a from (o horario nao atravessa a meia-noite)' };

  const textos = {};
  for (const chave of ['message_pt', 'message_en']) {
    const v = raw[chave] === undefined || raw[chave] === null ? '' : raw[chave];
    if (typeof v !== 'string' || v.trim().length > MAX_TEXTO) {
      return { ok: false, error: `${chave} tem de ser texto com ate ${MAX_TEXTO} caracteres` };
    }
    textos[chave] = v.trim();
  }

  const unicos = [...new Set(dias)].sort((a, b) => a - b);
  /* Ligada sem nenhum dia de atendimento responderia sempre: pede-se pelo menos um dia */
  if (raw.enabled && unicos.length === 0) return { ok: false, error: 'escolhe pelo menos um dia de atendimento' };

  return { ok: true, config: { enabled: raw.enabled, days: unicos, from, to, ...textos } };
}

/* Dia da semana (0-6) e minutos desde a meia-noite em Cabo Verde */
function agoraEmCaboVerde(agora) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora);
  const get = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return { dia: DIAS_INGLES[get('weekday')], min: Number(get('hour')) * 60 + Number(get('minute')) };
}

/* true se NAO ha atendimento neste momento (config ja validada) */
function foraDeHoras(config, agora = new Date()) {
  const { dia, min } = agoraEmCaboVerde(agora);
  if (!config.days.includes(dia)) return true;
  return min < minutos(config.from) || min >= minutos(config.to);
}

function textoDaResposta(config, lang) {
  if (lang === 'en') return config.message_en || TEXTO_EN;
  return config.message_pt || TEXTO_PT;
}

/* Decide se responde. A configuracao vem da base de dados: qualquer forma inesperada = nao responde.
   jaFalouRecentemente: o operador ou o sistema ja enviou algo a este hospede dentro da janela de silencio. */
function deveResponder({ config, agora = new Date(), jaFalouRecentemente }) {
  if (!ehObjecto(config) || config.enabled !== true) return false;
  const v = validarConfig(config);
  if (!v.ok || !v.config) return false;
  if (jaFalouRecentemente) return false;
  return foraDeHoras(v.config, agora);
}

module.exports = {
  validarConfig, foraDeHoras, textoDaResposta, deveResponder, agoraEmCaboVerde,
  TEXTO_PT, TEXTO_EN, JANELA_SILENCIO_HORAS, FUSO,
};
