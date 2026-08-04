const crypto = require('crypto');

/*
 * SISP Vinti4 — Integracao de pagamentos cabo-verdianos (protocolo VBV2/BizMPIOnUs)
 *
 * Fluxo real (NAO e uma API JSON):
 * 1. O nosso backend calcula um FingerPrint (SHA-512 encadeado, ver abaixo) e devolve
 *    ao frontend os campos de um formulario HTML.
 * 2. O frontend faz auto-submit desse formulario (POST) para a Vinti4 — o browser
 *    do CLIENTE e redireccionado para la, nao ha chamada servidor-a-servidor.
 * 3. Apos o pagamento (3D Secure), a Vinti4 faz POST directo para o nosso
 *    urlMerchantResponse com o resultado — e esse POST que validamos aqui.
 *
 * Algoritmo do FingerPrint confirmado byte-a-byte contra o motor PHP real da
 * SISP (ficheiros de exemplo lib.php/postback.php/callback.php fornecidos),
 * nao apenas contra a documentacao em texto.
 */

const SISP_POST_URL = 'https://mc.vinti4net.cv/BizMPIOnUs/CardPayment';
const SUCCESS_MESSAGE_TYPES = ['8', '10', 'P', 'M'];
const CVE_CURRENCY_CODE = '132';

function sha512Base64(str) {
  return crypto.createHash('sha512').update(String(str), 'utf8').digest('base64');
}

/* Remove zeros a esquerda de entityCode/referenceNumber, tal como o codigo de
   referencia da SISP faz — campos vazios ficam vazios. */
function normalizarInt(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  return String(parseInt(valor, 10));
}

function gerarFingerprintEnvio({
  posAutCode, timestamp, amount, merchantRef, merchantSession,
  posID, currency, transactionCode, entityCode, referenceNumber,
}) {
  const toHash = sha512Base64(posAutCode) + timestamp + Math.trunc(parseFloat(amount) * 1000)
    + String(merchantRef).trim() + String(merchantSession).trim() + String(posID).trim()
    + String(currency).trim() + String(transactionCode).trim()
    + normalizarInt(entityCode) + normalizarInt(referenceNumber);
  return sha512Base64(toHash);
}

function gerarFingerprintResposta({
  posAutCode, messageType, clearingPeriod, transactionID, merchantReference,
  merchantSession, amount, messageID, pan, merchantResponse, timestamp,
  reference, entity, clientReceipt, additionalErrorMessage, reloadCode,
}) {
  const toHash = sha512Base64(posAutCode) + messageType + clearingPeriod + transactionID
    + merchantReference + merchantSession
    + Math.trunc(parseFloat(amount) * 1000) + String(messageID).trim() + String(pan).trim()
    + String(merchantResponse).trim() + timestamp + normalizarInt(reference)
    + normalizarInt(entity) + String(clientReceipt).trim() + String(additionalErrorMessage).trim()
    + String(reloadCode).trim();
  return sha512Base64(toHash);
}

function gerarReferencia(prefixo) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `${prefixo}${ts}${Math.floor(Math.random() * 1000)}`;
}

/*
 * Constroi os dados do formulario auto-submit que redirecciona o cliente para
 * a Vinti4. amount deve vir ja em CVE (a rede so aceita escudos — codigo 132).
 */
function construirPedidoPagamento({
  posID, posAutCode, amount, urlMerchantResponse,
  transactionCode = '1', language = 'pt', entityCode = '', referenceNumber = '',
}) {
  if (!posID || !posAutCode) {
    throw new Error('Operador sem credenciais SISP configuradas (POS ID / POS Auth Code)');
  }

  const merchantRef = gerarReferencia('R');
  const merchantSession = gerarReferencia('S');
  const timeStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const amountStr = String(Math.round(Number(amount)));

  const fields = {
    transactionCode,
    posID,
    merchantRef,
    merchantSession,
    amount: amountStr,
    currency: CVE_CURRENCY_CODE,
    is3DSec: '1',
    urlMerchantResponse,
    languageMessages: language,
    timeStamp,
    fingerprintversion: '1',
    entityCode,
    referenceNumber,
  };

  fields.fingerprint = gerarFingerprintEnvio({
    posAutCode, timestamp: timeStamp, amount: amountStr,
    merchantRef, merchantSession, posID, currency: CVE_CURRENCY_CODE,
    transactionCode, entityCode, referenceNumber,
  });

  return { postUrl: SISP_POST_URL, fields, merchantRef, merchantSession };
}

/*
 * Valida o POST que a Vinti4 envia para urlMerchantResponse depois do
 * pagamento. posAutCode tem de ser o mesmo usado no pedido original.
 */
function validarResposta(posAutCode, body) {
  if (body.UserCancelled === 'true') {
    return { status: 'cancelled' };
  }

  if (!body.messageType || !SUCCESS_MESSAGE_TYPES.includes(body.messageType)) {
    return {
      status: 'error',
      errorDescription: body.merchantRespErrorDescription || null,
      errorDetail: body.merchantRespErrorDetail || null,
    };
  }

  const fingerprintCalculado = gerarFingerprintResposta({
    posAutCode,
    messageType: body.messageType,
    clearingPeriod: body.merchantRespCP,
    transactionID: body.merchantRespTid,
    merchantReference: body.merchantRespMerchantRef,
    merchantSession: body.merchantRespMerchantSession,
    amount: body.merchantRespPurchaseAmount,
    messageID: body.merchantRespMessageID,
    pan: body.merchantRespPan,
    merchantResponse: body.merchantResp,
    timestamp: body.merchantRespTimeStamp,
    reference: body.merchantRespReferenceNumber,
    entity: body.merchantRespEntityCode,
    clientReceipt: body.merchantRespClientReceipt,
    additionalErrorMessage: (body.merchantRespAdditionalErrorMessage || '').trim(),
    reloadCode: body.merchantRespReloadCode,
  });

  if (fingerprintCalculado !== body.resultFingerPrint) {
    return { status: 'invalid_fingerprint' };
  }

  return {
    status: 'paid',
    merchantRef: body.merchantRespMerchantRef,
    transactionID: body.merchantRespTid,
    amount: Number(body.merchantRespPurchaseAmount),
  };
}

module.exports = {
  construirPedidoPagamento,
  validarResposta,
  gerarFingerprintEnvio,
  gerarFingerprintResposta,
};
