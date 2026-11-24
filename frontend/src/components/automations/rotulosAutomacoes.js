/* Rotulos dos valores gravados nas automacoes (gatilho e canal). O valor gravado nunca muda: so o texto
   mostrado passa pela traducao. Um valor que o mapa nao conhece mostra-se tal e qual. */
const tem = (mapa, valor) => Object.prototype.hasOwnProperty.call(mapa, valor);

const GATILHOS = ['booking_confirmed', 'checkin_reminder', 'checkout_thanks', 'days_before_checkin', 'days_after_checkout'];
const GATILHOS_COM_DIAS = ['days_before_checkin', 'days_after_checkout'];

/* Gatilho no cartao de uma automacao: os que contam dias levam o numero */
export function rotuloGatilho(tipo, dias, t) {
  if (!GATILHOS.includes(tipo)) return tipo;
  return t(`automations.trigger.${tipo}`, { days: dias });
}

/* Gatilho como opcao do formulario ("X dias antes...") */
export function rotuloGatilhoOpcao(tipo, t) {
  return GATILHOS.includes(tipo) ? t(`automations.triggerOption.${tipo}`) : tipo;
}

export const gatilhoTemDias = (tipo) => GATILHOS_COM_DIAS.includes(tipo);

/* Canal: nomes proprios, iguais em todas as linguas */
const CANAIS = { email: 'Email', whatsapp: 'WhatsApp' };
export function rotuloCanal(canal) {
  return tem(CANAIS, canal) ? CANAIS[canal] : canal;
}
