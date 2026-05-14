const axios = require('axios');
const crypto = require('crypto');

/*
 * SISP Vinti4 — Integracao de pagamentos cabo-verdianos
 * NOTA CRITICA: Requer contrato formal com sisp.cv (2-6 semanas)
 * As credenciais sao fornecidas pela SISP apos aprovacao do contrato.
 * Em desenvolvimento, todas as chamadas devolvem dados de simulacao.
 */

const SISP_URL = process.env.SISP_API_URL || 'https://mc.vinti4net.cv';
const DEV_MODE = !process.env.SISP_MERCHANT_ID || process.env.SISP_MERCHANT_ID === 'xxx';

function gerarReferencia() {
  return `SD${Date.now().toString(36).toUpperCase()}`;
}

async function iniciarPagamento({ amount, currency = 'CVE', reservationId, returnUrl, cancelUrl }) {
  if (DEV_MODE) {
    return {
      payment_url: `${returnUrl}?sisp_sim=1&ref=${gerarReferencia()}&amount=${amount}`,
      reference: gerarReferencia(),
      dev_mode: true,
    };
  }

  const ref = gerarReferencia();
  const params = {
    MerchantID:    process.env.SISP_MERCHANT_ID,
    Amount:        Number(amount).toFixed(2),
    Currency:      currency,
    TransactionID: ref,
    Description:   `Reserva SalDesk ${reservationId}`,
    ReturnURL:     returnUrl,
    CancelURL:     cancelUrl,
  };

  const signature = crypto
    .createHmac('sha256', process.env.SISP_API_KEY || '')
    .update(JSON.stringify(params))
    .digest('hex');

  params.Signature = signature;

  const { data } = await axios.post(`${SISP_URL}/payment/init`, params, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  return { payment_url: data.PaymentURL, reference: ref };
}

async function verificarPagamento(transactionId) {
  if (DEV_MODE) return { status: 'paid', amount: 0 };

  const { data } = await axios.get(`${SISP_URL}/payment/status/${transactionId}`, {
    headers: { 'X-API-Key': process.env.SISP_API_KEY },
    timeout: 10000,
  });
  return { status: data.Status === '0' ? 'paid' : 'pending', amount: data.Amount };
}

module.exports = { iniciarPagamento, verificarPagamento };
