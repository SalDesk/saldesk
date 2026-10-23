/* WameProvider: default de todos os planos.

   Nao envia nada: gera o link https://wa.me/<numero>?text=<mensagem> com a mensagem
   ja renderizada, e quem toca no botao (operador ou staff) e o humano. Por isso send()
   devolve sempre 'handoff'. Sem automacao real e sem confirmacao de entrega, mas sem
   risco de conta nem custo por mensagem. */

const { soDigitos } = require('../phone');

// Acima disto alguns navegadores/apps cortam o link; nenhuma mensagem normal chega la.
const MAX_TEXTO = 3000;

const capabilities = {
  automatedSend: false,
  inbound: false,
  freeformOutside24h: true, // e o humano que inicia a conversa
  templates: false,
  media: false,
  officialApi: true,
};

function construirLink(toE164, text) {
  return `https://wa.me/${soDigitos(toE164)}?text=${encodeURIComponent(text)}`;
}

/* Nunca lanca excepcao para erros esperados: devolve 'failed'. */
async function send(msg) {
  const digitos = soDigitos(msg?.to);
  if (digitos.length < 8) return { status: 'failed', reason: 'numero_invalido', permanent: true };
  const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
  if (!text) return { status: 'failed', reason: 'mensagem_vazia', permanent: true };
  if (text.length > MAX_TEXTO) return { status: 'failed', reason: 'mensagem_demasiado_longa', permanent: true };
  return { status: 'handoff', url: construirLink(msg.to, text) };
}

module.exports = { id: 'wame', capabilities, send, construirLink };
