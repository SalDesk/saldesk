const axios = require('axios');

/* Conta PayPal Business da propria SalDesk -- para cobrar a subscricao dos
   operadores, distinta das credenciais por-operador em paypalService.js
   (usadas para os operadores cobrarem os SEUS clientes). */
const BASE = process.env.PLATFORM_PAYPAL_MODE === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const CLIENT_ID     = process.env.PLATFORM_PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PLATFORM_PAYPAL_CLIENT_SECRET;
const WEBHOOK_ID    = process.env.PLATFORM_PAYPAL_WEBHOOK_ID;

async function getAccessToken() {
  const { data } = await axios.post(
    `${BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: CLIENT_ID, password: CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return data.access_token;
}

async function createOrder(amountEur, plan, returnUrl, cancelUrl) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'EUR', value: Number(amountEur).toFixed(2) },
        description: `Subscricao SalDesk — plano ${plan}`,
      }],
      application_context: {
        brand_name: 'SalDesk',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

async function captureOrder(orderId) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v2/checkout/orders/${orderId}/capture`,
    {},
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

/* Verificacao real da assinatura do webhook (ao contrario do stub em
   paypalService.js) -- chama o endpoint oficial da PayPal, que confirma
   se o evento recebido foi mesmo assinado pela PayPal e nao forjado. */
async function verifyWebhookSignature(headers, body) {
  if (!WEBHOOK_ID) return false;
  try {
    const token = await getAccessToken();
    const { data } = await axios.post(
      `${BASE}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo:         headers['paypal-auth-algo'],
        cert_url:          headers['paypal-cert-url'],
        transmission_id:   headers['paypal-transmission-id'],
        transmission_sig:  headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id:        WEBHOOK_ID,
        webhook_event:     body,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('[Platform PayPal] Falha ao verificar assinatura do webhook:', err.message);
    return false;
  }
}

module.exports = { createOrder, captureOrder, verifyWebhookSignature };
