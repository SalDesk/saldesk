const axios = require('axios');

const BASE = process.env.PAYPAL_MODE === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const { data } = await axios.post(
    `${BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return data.access_token;
}

async function createOrder(amount, currency = 'EUR', description = 'SalDesk Reservation') {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency, value: Number(amount).toFixed(2) },
        description,
      }],
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

async function refundCapture(captureId, amount, currency = 'EUR') {
  const token = await getAccessToken();
  const body = amount ? { amount: { currency_code: currency, value: Number(amount).toFixed(2) } } : {};
  const { data } = await axios.post(
    `${BASE}/v2/payments/captures/${captureId}/refund`,
    body,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

function verifyWebhookSignature(headers, body, webhookId) {
  /* Verificacao simplificada — em producao usar SDK oficial */
  const eventId = headers['paypal-transmission-id'];
  return !!eventId;
}

module.exports = { createOrder, captureOrder, refundCapture, verifyWebhookSignature };
