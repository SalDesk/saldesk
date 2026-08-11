const axios = require('axios');

/* Conta PayPal Business da propria SalDesk -- para cobrar a subscricao dos
   operadores, distinta das credenciais por-operador em paypalService.js
   (usadas para os operadores cobrarem os SEUS clientes). Usa a
   Subscriptions API (cobranca recorrente real), nao a Orders API
   (pagamento unico). */
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

/* Passo 1 de setup (uma vez por instalacao) -- o "produto" a que os
   planos de preco ficam ligados. Chamado por ensurePaypalPlan quando
   ainda nao existe nenhum plano criado. */
async function createProduct() {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v1/catalogs/products`,
    {
      name: 'Subscricao SalDesk',
      description: 'Subscricao mensal da plataforma SalDesk (gestao turistica)',
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

/* Passo 2 de setup (uma vez por tier) -- plano de preco fixo mensal,
   recorrente indefinidamente (total_cycles:0). */
async function createPlan(productId, plan, priceEur) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v1/billing/plans`,
    {
      product_id: productId,
      name: `SalDesk — ${plan}`,
      description: `Plano ${plan} da SalDesk, €${priceEur}/mes`,
      billing_cycles: [{
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: Number(priceEur).toFixed(2), currency_code: 'EUR' } },
      }],
      payment_preferences: { auto_bill_outstanding: true },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

async function createSubscription(planId, returnUrl, cancelUrl) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v1/billing/subscriptions`,
    {
      plan_id: planId,
      application_context: {
        brand_name: 'SalDesk',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

async function getSubscription(subscriptionId) {
  const token = await getAccessToken();
  const { data } = await axios.get(
    `${BASE}/v1/billing/subscriptions/${subscriptionId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

async function cancelSubscription(subscriptionId, reason) {
  const token = await getAccessToken();
  await axios.post(
    `${BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    { reason: reason || 'Cancelado pelo operador' },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
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

module.exports = {
  createProduct, createPlan, createSubscription, getSubscription, cancelSubscription,
  verifyWebhookSignature,
};
