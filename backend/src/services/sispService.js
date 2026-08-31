const crypto = require('crypto');

/*
 * SISP Vinti4 — Integracao de pagamentos cabo-verdianos (protocolo EMV 3DSecure
 * 2.2.0 / "3DSServer", especificacao MOP021.013 v13)
 *
 * 2026-08-31: reescrito depois de confirmar, atraves de uma integracao real e
 * em producao ja certificada pela SISP (jalchantretour.com, ficheiros de
 * referencia fornecidos pelo utilizador -- VintiFourGateway.php), que a nossa
 * versao anterior usava o protocolo ANTIGO (pre-3DSServer). Confirmado
 * tambem que NUNCA houve um pagamento SISP concluido com sucesso em producao
 * ate esta data (zero linhas payment_method='sisp' pagas) -- ou seja, esta
 * falha nunca tinha sido detectada por faltar um teste real de ponta-a-ponta.
 * Diferencas confirmadas face a versao anterior:
 *  - Nomes de campos capitalizados desde a v13 da spec: TimeStamp,
 *    FingerPrintVersion, FingerPrint (nao timeStamp/fingerprintversion/
 *    fingerprint em minusculas, que ficaram obsoletos e falham em silencio).
 *  - Novo campo obrigatorio "purchaseRequest": JSON (morada de facturacao,
 *    email, telefone) codificado em base64, exigido desde a migracao para o
 *    3DSServer 2.2.0 -- em complemento aos campos do FingerPrint, nunca os
 *    substitui. Sem ele, a SISP responde "purchaseRequest e obrigatorio para
 *    o funcionamento do Middleware".
 *  - O FingerPrint tambem vai como query string no proprio postUrl
 *    (?FingerPrint=...), a par de ir como campo hidden do formulario --
 *    confirmado no codigo real ja certificado, nao so na documentacao.
 *  - Cambio EUR->CVE mais preciso: 110.265 (nao 110 fixo).
 *  - "merchantID" nao consta de nenhuma tabela de campos do pedido de
 *    pagamento -- nunca enviar, so serve de referencia da credencial.
 *
 * Fluxo real (NAO e uma API JSON):
 * 1. O nosso backend calcula um FingerPrint (SHA-512 encadeado, ver abaixo) e devolve
 *    ao frontend os campos de um formulario HTML.
 * 2. O frontend faz auto-submit desse formulario (POST) para a Vinti4 — o browser
 *    do CLIENTE e redireccionado para la, nao ha chamada servidor-a-servidor.
 * 3. Apos o pagamento (3D Secure), a Vinti4 faz POST directo para o nosso
 *    urlMerchantResponse com o resultado — e esse POST que validamos aqui.
 */

/* Configuravel por variavel de ambiente (ex. apontar para o dominio de
   homologacao "3dsteste.vinti4net.cv/3ds_middleware_php/public/3ds_init.php"
   durante certificacao) -- nunca hardcoded como um unico valor universal,
   confirmado pelo .env.example real que homologacao/producao usam dominios
   distintos. Sem override, mantem o endpoint de producao ja usado. */
const SISP_POST_URL = process.env.SISP_GATEWAY_URL || 'https://mc.vinti4net.cv/BizMPIOnUs/CardPayment';
const SUCCESS_MESSAGE_TYPES = ['8', '10', 'P', 'M'];
const CVE_CURRENCY_CODE = '132';
const FINGERPRINT_VERSION = '1';

/* Cambio fixo CVE/EUR (Escudo cabo-verdiano indexado ao Euro desde 1998) --
   confirmado contra a integracao real ja certificada (110.265, nao 110). */
const CVE_PER_EUR = 110.265;

function sha512Base64(str) {
  return crypto.createHash('sha512').update(String(str), 'utf8').digest('base64');
}

/* Remove zeros a esquerda de entityCode/referenceNumber, tal como o codigo de
   referencia da SISP faz — campos vazios ficam vazios. */
function normalizarInt(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  return String(parseInt(valor, 10));
}

/* Codigo ISO 3166-1 NUMERICO (billAddrCountry) + indicativo telefonico
   (mobilePhone.cc), por codigo ISO 3166-1 ALPHA-2 (formato ja usado em
   reservations.customer_country). Nao e uma tabela legal/de facturacao
   critica -- serve sobretudo para pontuacao de risco 3DS (mesma nota da
   integracao de referencia) -- por isso cobre os paises mais provaveis de
   clientes/operadores e cai em Cabo Verde por omissao para os restantes. */
const COUNTRY_META = {
  CV: { numeric: '132', calling: '238' }, PT: { numeric: '620', calling: '351' },
  ES: { numeric: '724', calling: '34' },  FR: { numeric: '250', calling: '33' },
  DE: { numeric: '276', calling: '49' },  IT: { numeric: '380', calling: '39' },
  GB: { numeric: '826', calling: '44' },  NL: { numeric: '528', calling: '31' },
  BE: { numeric: '056', calling: '32' },  CH: { numeric: '756', calling: '41' },
  LU: { numeric: '442', calling: '352' }, SE: { numeric: '752', calling: '46' },
  NO: { numeric: '578', calling: '47' },  DK: { numeric: '208', calling: '45' },
  FI: { numeric: '246', calling: '358' }, IE: { numeric: '372', calling: '353' },
  AT: { numeric: '040', calling: '43' },  PL: { numeric: '616', calling: '48' },
  US: { numeric: '840', calling: '1' },   CA: { numeric: '124', calling: '1' },
  BR: { numeric: '076', calling: '55' },  SN: { numeric: '686', calling: '221' },
  MA: { numeric: '504', calling: '212' }, AO: { numeric: '024', calling: '244' },
  GW: { numeric: '624', calling: '245' }, MZ: { numeric: '508', calling: '258' },
  ST: { numeric: '678', calling: '239' }, ZA: { numeric: '710', calling: '27' },
  NG: { numeric: '566', calling: '234' }, GN: { numeric: '324', calling: '224' },
  GM: { numeric: '270', calling: '220' }, RU: { numeric: '643', calling: '7' },
  CN: { numeric: '156', calling: '86' },  JP: { numeric: '392', calling: '81' },
  AU: { numeric: '036', calling: '61' },  NZ: { numeric: '554', calling: '64' },
  IN: { numeric: '356', calling: '91' },  AR: { numeric: '032', calling: '54' },
  MX: { numeric: '484', calling: '52' },  CZ: { numeric: '203', calling: '420' },
  GR: { numeric: '300', calling: '30' },  HU: { numeric: '348', calling: '36' },
  RO: { numeric: '642', calling: '40' },  TR: { numeric: '792', calling: '90' },
  IL: { numeric: '376', calling: '972' }, AE: { numeric: '784', calling: '971' },
  SA: { numeric: '682', calling: '966' },
};

function countryMeta(alpha2) {
  return COUNTRY_META[String(alpha2 || '').toUpperCase()] || COUNTRY_META.CV;
}

/* Separa um telefone em [indicativo, numero local]. Tenta primeiro reconhecer
   o indicativo a partir dos proprios digitos (do mais longo para o mais
   curto, para nao confundir prefixos como "1" com "212"); so recorre ao
   indicativo do pais de facturacao como ultimo recurso. Mesma logica da
   integracao de referencia real. */
function splitPhoneNumber(digits, fallbackCalling) {
  if (!digits) return { cc: fallbackCalling, subscriber: '' };
  const knownCodes = [...new Set(Object.values(COUNTRY_META).map((c) => c.calling))]
    .sort((a, b) => b.length - a.length);
  for (const code of knownCodes) {
    if (digits.startsWith(code) && digits.length - code.length >= 6) {
      return { cc: code, subscriber: digits.slice(code.length) };
    }
  }
  return { cc: fallbackCalling, subscriber: digits.replace(/^0+/, '') };
}

/* Constroi o JSON de "Parametros adicionais para processamentos 3DSServer"
   (MOP021.013, seccao 2.2.1), codificado em base64 -- campo "purchaseRequest".
   billAddrCity/billAddrLine1 podem ficar vazios quando nao ha esse dado
   (nem reservations nem operators guardam morada estruturada hoje), mas
   billAddrPostCode nunca fica vazio (fallback '0000') -- mesmo comportamento
   ja usado e certificado na integracao de referencia real.
   chAccAgeInd fica sempre "02" (criado durante a transaccao): nem clientes
   de reserva nem operadores tem um "login" para este pagamento especifico,
   por isso nao ha outro valor honesto a usar (a SISP desaconselha "01 =
   sem conta" na sua propria FAQ de migracao 3DSServer). addrMatch fica
   sempre "Y": nunca recolhemos uma morada de entrega separada da de
   facturacao (nao ha envio fisico nem em reservas nem na subscricao). */
function gerarPurchaseRequest({ email, phone, countryAlpha2, address, city, postalCode }) {
  const meta = countryMeta(countryAlpha2);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rawDigits = String(phone || '').replace(/\D+/g, '');
  const { cc, subscriber } = splitPhoneNumber(rawDigits, meta.calling);

  const payload = {
    acctID: email || '',
    acctInfo: {
      chAccAgeInd: '02',
      chAccChange: today,
      chAccDate: today,
      chAccPwChange: today,
      chAccPwChangeInd: '02',
      suspiciousAccActivity: '01',
    },
    email: email || '',
    addrMatch: 'Y',
    billAddrCountry: meta.numeric,
    billAddrCity: city || '',
    billAddrLine1: address || '',
    billAddrPostCode: postalCode ? String(postalCode) : '0000',
  };
  if (subscriber) payload.mobilePhone = { cc, subscriber };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
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

/* merchantSession tem limite de 15 caracteres (MOP021.013, pag. 8) --
   confirmado tambem no codigo real ja certificado ('S' + 14 hex). A versao
   anterior usava gerarReferencia('S') para isto, que podia chegar aos 18
   caracteres (1+14+3) -- nunca teria passado de um pagamento real, so nao
   tinha sido detectado por faltar um teste de ponta-a-ponta. */
function gerarMerchantSession() {
  return `S${crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 14)}`;
}

/*
 * Constroi os dados do formulario auto-submit que redirecciona o cliente para
 * a Vinti4. amount deve vir ja em CVE (a rede so aceita escudos — codigo 132).
 * `customer` alimenta o purchaseRequest (ver gerarPurchaseRequest) -- nunca
 * inventado, so os dados reais que o caller tiver disponiveis.
 */
function construirPedidoPagamento({
  posID, posAutCode, amount, urlMerchantResponse,
  transactionCode = '1', language = 'pt', entityCode = '', referenceNumber = '',
  customer = {},
}) {
  if (!posID || !posAutCode) {
    throw new Error('Operador sem credenciais SISP configuradas (POS ID / POS Auth Code)');
  }

  const merchantRef = gerarReferencia('R');
  const merchantSession = gerarMerchantSession();
  const timeStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const amountStr = String(Math.round(Number(amount)));
  const purchaseRequest = gerarPurchaseRequest(customer);

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
    entityCode,
    referenceNumber,
    TimeStamp: timeStamp,
    FingerPrintVersion: FINGERPRINT_VERSION,
    purchaseRequest,
  };

  fields.FingerPrint = gerarFingerprintEnvio({
    posAutCode, timestamp: timeStamp, amount: amountStr,
    merchantRef, merchantSession, posID, currency: CVE_CURRENCY_CODE,
    transactionCode, entityCode, referenceNumber,
  });

  /* O FingerPrint vai TAMBEM como query string no proprio postUrl, a par de
     ir como campo hidden do formulario -- confirmado no codigo real ja
     certificado (nao so na documentacao), nao e redundancia nossa. */
  const postUrl = `${SISP_POST_URL}?FingerPrint=${encodeURIComponent(fields.FingerPrint)}`;

  return { postUrl, fields, merchantRef, merchantSession };
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
  CVE_PER_EUR,
};
